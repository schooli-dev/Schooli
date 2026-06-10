import crypto from "node:crypto";
import type { PoolClient } from "pg";
import { zoomConfig, isZoomMeetingSdkConfigured, isZoomServerConfigured } from "../../config/zoom.js";
import { pool } from "../../db/pool.js";
import { ApiError } from "../../utils/ApiError.js";

type ZoomTokenResponse = {
  access_token: string;
  expires_in: number;
};

type ZoomMeetingResponse = {
  id: number;
  uuid: string;
  password?: string;
  join_url?: string;
  start_url?: string;
  status?: string;
};

type ZoomZakResponse = {
  token: string;
};

type CreateZoomMeetingInput = {
  classId: string;
  topic: string;
  startTime: Date;
  durationMinutes: number;
  timezone: string;
};

type ZoomMeetingRow = {
  id: string;
  class_id: string;
  zoom_meeting_id: string | null;
  zoom_uuid: string | null;
  zoom_password: string | null;
  zoom_join_url: string | null;
  zoom_start_url: string | null;
  status: string;
  creation_status: string;
  raw_payload: unknown;
  created_at: Date;
  updated_at: Date;
};

type LiveZoomClassRow = {
  id: string;
  title: string;
  zoom_meeting_id: string | null;
};

let cachedToken: { token: string; expiresAt: number } | null = null;

export async function createZoomMeetingForClass(
  input: CreateZoomMeetingInput,
  client?: PoolClient
): Promise<void> {
  const db = client ?? pool;

  if (!zoomConfig.autoCreateMeetings || !isZoomServerConfigured()) {
    await ensureZoomPlaceholder(input.classId, db);
    return;
  }

  try {
    const token = await getZoomAccessToken();
    const response = await fetch(
      `https://api.zoom.us/v2/users/${encodeURIComponent(zoomConfig.defaultHostEmail!)}/meetings`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          topic: input.topic,
          type: 2,
          start_time: input.startTime.toISOString(),
          duration: input.durationMinutes,
          timezone: input.timezone,
          ...(zoomConfig.passwordRequired ? { password: generateZoomPassword() } : {}),
          settings: {
            waiting_room: zoomConfig.waitingRoom,
            join_before_host: zoomConfig.joinBeforeHost,
            auto_recording: zoomConfig.autoRecording,
            meeting_authentication: false
          }
        })
      }
    );

    const payload = (await response.json()) as ZoomMeetingResponse & { message?: string };

    if (!response.ok) {
      await markZoomCreationFailed(input.classId, payload, db);
      throw new ApiError(502, "Zoom meeting creation failed", "ZOOM_CREATE_FAILED", payload);
    }

    await db.query(
      `
        INSERT INTO zoom_meetings (
          class_id,
          zoom_meeting_id,
          zoom_uuid,
          zoom_password,
          zoom_join_url,
          zoom_start_url,
          status,
          creation_status,
          raw_payload
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', 'created', $7::JSONB)
        ON CONFLICT (class_id) DO UPDATE
        SET zoom_meeting_id = EXCLUDED.zoom_meeting_id,
            zoom_uuid = EXCLUDED.zoom_uuid,
            zoom_password = EXCLUDED.zoom_password,
            zoom_join_url = EXCLUDED.zoom_join_url,
            zoom_start_url = EXCLUDED.zoom_start_url,
            status = EXCLUDED.status,
            creation_status = EXCLUDED.creation_status,
            raw_payload = EXCLUDED.raw_payload,
            updated_at = NOW()
      `,
      [
        input.classId,
        String(payload.id),
        payload.uuid,
        payload.password ?? null,
        payload.join_url ?? null,
        payload.start_url ?? null,
        JSON.stringify(payload)
      ]
    );
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    await markZoomCreationFailed(input.classId, { message: "Zoom request failed" }, db);
    throw new ApiError(502, "Zoom meeting creation failed", "ZOOM_CREATE_FAILED");
  }
}

export async function cancelZoomMeetingForClass(classId: string, client?: PoolClient): Promise<void> {
  const db = client ?? pool;
  const result = await db.query<{ zoom_meeting_id: string | null; creation_status: string }>(
    `
      SELECT zoom_meeting_id, creation_status
      FROM zoom_meetings
      WHERE class_id = $1
      LIMIT 1
    `,
    [classId]
  );
  const meeting = result.rows[0];

  if (!meeting) {
    return;
  }

  if (zoomConfig.autoCreateMeetings && isZoomServerConfigured() && meeting.zoom_meeting_id && meeting.creation_status === "created") {
    const token = await getZoomAccessToken();
    const response = await fetch(
      `https://api.zoom.us/v2/meetings/${encodeURIComponent(meeting.zoom_meeting_id)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (!response.ok && response.status !== 404) {
      const payload = await response.json().catch(() => ({ message: "Zoom meeting cancellation failed" }));
      throw new ApiError(502, "Zoom meeting cancellation failed", "ZOOM_CANCEL_FAILED", payload);
    }
  }

  await db.query(
    `
      UPDATE zoom_meetings
      SET status = 'cancelled',
          creation_status = CASE WHEN creation_status = 'created' THEN 'cancelled' ELSE creation_status END,
          updated_at = NOW()
      WHERE class_id = $1
    `,
    [classId]
  );
}

export async function getZoomMeetingById(id: string): Promise<ReturnType<typeof mapZoomMeeting>> {
  const result = await pool.query<ZoomMeetingRow>(
    `
      SELECT id, class_id, zoom_meeting_id, zoom_uuid, zoom_password, zoom_join_url, zoom_start_url,
             status, creation_status, raw_payload, created_at, updated_at
      FROM zoom_meetings
      WHERE id = $1
         OR class_id = $1
    `,
    [id]
  );
  const meeting = result.rows[0];

  if (!meeting) {
    throw new ApiError(404, "Zoom meeting not found", "ZOOM_MEETING_NOT_FOUND");
  }

  return mapZoomMeeting(meeting);
}

export async function createZoomMeetingByClassId(classId: string): Promise<ReturnType<typeof mapZoomMeeting>> {
  const classResult = await pool.query<{
    id: string;
    title: string;
    start_time: Date;
    duration_minutes: number;
    timezone: string;
  }>(
    `
      SELECT id, title, start_time, duration_minutes, timezone
      FROM classes
      WHERE id = $1
    `,
    [classId]
  );
  const classRow = classResult.rows[0];

  if (!classRow) {
    throw new ApiError(404, "Class not found", "CLASS_NOT_FOUND");
  }

  await createZoomMeetingForClass({
    classId: classRow.id,
    topic: classRow.title,
    startTime: classRow.start_time,
    durationMinutes: classRow.duration_minutes,
    timezone: classRow.timezone
  });

  return await getZoomMeetingByClassId(classId);
}

export async function getZoomMeetingByClassId(classId: string): Promise<ReturnType<typeof mapZoomMeeting>> {
  const result = await pool.query<ZoomMeetingRow>(
    `
      SELECT id, class_id, zoom_meeting_id, zoom_uuid, zoom_password, zoom_join_url, zoom_start_url,
             status, creation_status, raw_payload, created_at, updated_at
      FROM zoom_meetings
      WHERE class_id = $1
    `,
    [classId]
  );
  const meeting = result.rows[0];

  if (!meeting) {
    throw new ApiError(404, "Zoom meeting not found", "ZOOM_MEETING_NOT_FOUND");
  }

  return mapZoomMeeting(meeting);
}

export async function getJoinableZoomMeetingByClassId(classId: string): Promise<ReturnType<typeof mapZoomMeeting>> {
  const meeting = await getZoomMeetingByClassId(classId);

  if (!meeting.zoomMeetingId || meeting.creationStatus !== "created") {
    return meeting;
  }

  if (!zoomConfig.autoCreateMeetings || !isZoomServerConfigured()) {
    return meeting;
  }

  const exists = await verifyZoomMeetingExists(meeting.zoomMeetingId);

  if (exists) {
    return meeting;
  }

  return await createZoomMeetingByClassId(classId);
}

export function verifyZoomWebhook(headers: Record<string, unknown>, rawBody: unknown): void {
  if (!zoomConfig.webhookSecretToken) {
    return;
  }

  const timestamp = String(headers["x-zm-request-timestamp"] ?? "");
  const signature = String(headers["x-zm-signature"] ?? "");

  if (!timestamp || !signature) {
    throw new ApiError(401, "Missing Zoom webhook signature", "ZOOM_WEBHOOK_SIGNATURE_MISSING");
  }

  const body = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody);
  const message = `v0:${timestamp}:${body}`;
  const expected = `v0=${crypto
    .createHmac("sha256", zoomConfig.webhookSecretToken)
    .update(message)
    .digest("hex")}`;

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new ApiError(401, "Invalid Zoom webhook signature", "ZOOM_WEBHOOK_SIGNATURE_INVALID");
  }
}

export async function handleZoomWebhook(payload: any): Promise<unknown> {
  if (payload?.event === "endpoint.url_validation") {
    const plainToken = payload.payload?.plainToken;

    if (!plainToken || !zoomConfig.webhookSecretToken) {
      throw new ApiError(400, "Invalid Zoom URL validation payload", "ZOOM_WEBHOOK_VALIDATION_INVALID");
    }

    return {
      plainToken,
      encryptedToken: crypto
        .createHmac("sha256", zoomConfig.webhookSecretToken)
        .update(plainToken)
        .digest("hex")
    };
  }

  if (payload?.event === "meeting.participant_joined" || payload?.event === "meeting.participant_left") {
    await storeZoomAttendanceEvent(payload);
  }

  return { received: true };
}

export function createMeetingSdkSignature(meetingNumber: string, role: 0 | 1): {
  sdkKey: string;
  signature: string;
} {
  if (!isZoomMeetingSdkConfigured()) {
    throw new ApiError(503, "Zoom Meeting SDK is not configured", "ZOOM_MEETING_SDK_NOT_CONFIGURED");
  }

  const iat = Math.floor(Date.now() / 1000) - 30;
  const exp = iat + 60 * 60 * 2;
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      mn: meetingNumber,
      role,
      iat,
      exp,
      appKey: zoomConfig.meetingSdkKey,
      tokenExp: exp
    })
  );
  const signature = crypto
    .createHmac("sha256", zoomConfig.meetingSdkSecret!)
    .update(`${header}.${payload}`)
    .digest("base64url");

  return {
    sdkKey: zoomConfig.meetingSdkKey!,
    signature: `${header}.${payload}.${signature}`
  };
}

export async function getZoomHostZak(): Promise<string> {
  if (!isZoomServerConfigured()) {
    throw new ApiError(503, "Zoom server credentials are not configured", "ZOOM_NOT_CONFIGURED");
  }

  const token = await getZoomAccessToken();
  const response = await fetch(
    `https://api.zoom.us/v2/users/${encodeURIComponent(zoomConfig.defaultHostEmail!)}/token?type=zak`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );
  const payload = (await response.json()) as ZoomZakResponse & { message?: string };

  if (!response.ok || !payload.token) {
    throw new ApiError(502, "Zoom ZAK token request failed", "ZOOM_ZAK_FAILED", payload);
  }

  return payload.token;
}

export async function markClassLiveForMeetingSdk(classId: string): Promise<void> {
  await pool.query(
    `
      UPDATE classes
      SET status = 'live',
          updated_at = NOW()
      WHERE id = $1
        AND status IN ('scheduled', 'rescheduled', 'live')
    `,
    [classId]
  );

  await pool.query(
    `
      UPDATE teacher_work_sessions
      SET status = 'live',
          updated_at = NOW()
      WHERE class_id = $1
        AND status IN ('scheduled', 'rescheduled', 'live')
    `,
    [classId]
  );

  await pool.query(
    `
      UPDATE zoom_meetings
      SET status = 'started',
          updated_at = NOW()
      WHERE class_id = $1
        AND status IN ('pending', 'scheduled', 'started')
    `,
    [classId]
  );
}

export async function releaseClassroomForMeetingSdk(
  classId: string,
  userId: string,
  role: 0 | 1
): Promise<void> {
  if (role === 1) {
    await pool.query(
      `
        UPDATE classes
        SET status = CASE WHEN end_time <= NOW() THEN 'completed'::class_status ELSE 'scheduled'::class_status END,
            updated_at = NOW()
        WHERE id = $1
          AND status = 'live'
      `,
      [classId]
    );

    await pool.query(
      `
        UPDATE teacher_work_sessions
        SET status = CASE WHEN end_time <= NOW() THEN 'completed' ELSE 'scheduled' END,
            updated_at = NOW()
        WHERE class_id = $1
          AND status = 'live'
      `,
      [classId]
    );

    await pool.query(
      `
        UPDATE zoom_meetings
        SET status = CASE
              WHEN EXISTS (SELECT 1 FROM classes c WHERE c.id = $1 AND c.end_time <= NOW()) THEN 'ended'::zoom_meeting_status
              ELSE 'scheduled'::zoom_meeting_status
            END,
            updated_at = NOW()
        WHERE class_id = $1
          AND status = 'started'
      `,
      [classId]
    );

    return;
  }

  await pool.query(
    `
      UPDATE class_participants
      SET left_at = NOW(),
          updated_at = NOW()
      WHERE class_id = $1
        AND student_id = $2
    `,
    [classId, userId]
  );
}

export async function getOtherLiveDefaultHostClass(classId: string): Promise<LiveZoomClassRow | null> {
  const result = await pool.query<LiveZoomClassRow>(
    `
      SELECT c.id,
             c.title,
             zm.zoom_meeting_id
      FROM classes c
      JOIN zoom_meetings zm ON zm.class_id = c.id
      WHERE c.id <> $1
        AND c.status = 'live'
        AND c.end_time > NOW() - INTERVAL '2 hours'
        AND zm.creation_status = 'created'
      ORDER BY c.updated_at DESC
      LIMIT 1
    `,
    [classId]
  );

  return result.rows[0] ?? null;
}

async function getZoomAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  if (!isZoomServerConfigured()) {
    throw new ApiError(503, "Zoom server credentials are not configured", "ZOOM_NOT_CONFIGURED");
  }

  const basic = Buffer.from(`${zoomConfig.clientId}:${zoomConfig.clientSecret}`).toString("base64");
  const response = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(
      zoomConfig.accountId!
    )}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`
      }
    }
  );
  const payload = (await response.json()) as ZoomTokenResponse & { reason?: string };

  if (!response.ok) {
    throw new ApiError(502, "Zoom access token request failed", "ZOOM_TOKEN_FAILED", payload);
  }

  cachedToken = {
    token: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000
  };

  return cachedToken.token;
}

async function verifyZoomMeetingExists(meetingNumber: string): Promise<boolean> {
  const token = await getZoomAccessToken();
  const response = await fetch(`https://api.zoom.us/v2/meetings/${encodeURIComponent(meetingNumber)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (response.status === 404) {
    return false;
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ message: "Zoom meeting verification failed" }));
    throw new ApiError(502, "Zoom meeting verification failed", "ZOOM_VERIFY_FAILED", payload);
  }

  return true;
}

async function ensureZoomPlaceholder(classId: string, db: PoolClient | typeof pool): Promise<void> {
  await db.query(
    `
      INSERT INTO zoom_meetings (class_id, status, creation_status, raw_payload)
      VALUES ($1, 'pending', 'skipped', '{}'::JSONB)
      ON CONFLICT (class_id) DO NOTHING
    `,
    [classId]
  );
}

async function markZoomCreationFailed(
  classId: string,
  payload: unknown,
  db: PoolClient | typeof pool
): Promise<void> {
  await db.query(
    `
      INSERT INTO zoom_meetings (class_id, status, creation_status, raw_payload)
      VALUES ($1, 'failed', 'failed', $2::JSONB)
      ON CONFLICT (class_id) DO UPDATE
      SET status = 'failed',
          creation_status = 'failed',
          raw_payload = EXCLUDED.raw_payload,
          updated_at = NOW()
    `,
    [classId, JSON.stringify(payload)]
  );
}

async function storeZoomAttendanceEvent(payload: any): Promise<void> {
  const object = payload?.payload?.object;
  const participant = object?.participant;
  const zoomMeetingId = object?.id ? String(object.id) : null;

  if (!zoomMeetingId) {
    return;
  }

  const meeting = await pool.query<{ class_id: string }>(
    "SELECT class_id FROM zoom_meetings WHERE zoom_meeting_id = $1",
    [zoomMeetingId]
  );
  const classId = meeting.rows[0]?.class_id;

  if (!classId) {
    return;
  }

  const eventType = payload.event === "meeting.participant_joined" ? "join" : "leave";

  await pool.query(
    `
      INSERT INTO zoom_attendance_events (
        class_id,
        zoom_participant_name,
        zoom_participant_email,
        event_type,
        event_time,
        raw_payload
      )
      VALUES ($1, $2, $3, $4, $5, $6::JSONB)
    `,
    [
      classId,
      participant?.user_name ?? null,
      participant?.email ?? null,
      eventType,
      participant?.date_time ? new Date(participant.date_time) : new Date(),
      JSON.stringify(payload)
    ]
  );
}

function mapZoomMeeting(row: ZoomMeetingRow) {
  return {
    id: row.id,
    classId: row.class_id,
    zoomMeetingId: row.zoom_meeting_id,
    zoomUuid: row.zoom_uuid,
    zoomPassword: row.zoom_password,
    joinUrl: row.zoom_join_url,
    startUrl: row.zoom_start_url,
    status: row.status,
    creationStatus: row.creation_status,
    rawPayload: row.raw_payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function generateZoomPassword(): string {
  return crypto.randomBytes(6).toString("base64url").slice(0, 10);
}
