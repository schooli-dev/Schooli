import crypto from "node:crypto";
import type { PoolClient } from "pg";
import { dailyConfig, getDailyApiBaseUrl, getDailyDomainUrl, isDailyConfigured } from "../../config/daily.js";
import { pool } from "../../db/pool.js";
import type { AuthenticatedUser } from "../../types/express.js";
import { ApiError } from "../../utils/ApiError.js";

type CreateDailyRoomInput = {
  classId: string;
  topic: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
};

type DailyRoomResponse = {
  id?: string;
  name: string;
  url: string;
  privacy?: string;
  config?: Record<string, unknown>;
  created_at?: string;
};

type DailyTokenResponse = {
  token: string;
};

type VideoMeetingRow = {
  id: string;
  class_id: string;
  provider: "daily";
  provider_meeting_id: string | null;
  provider_room_name: string | null;
  provider_room_url: string | null;
  provider_password: string | null;
  status: string;
  creation_status: string;
  raw_payload: unknown;
  created_at: Date;
  updated_at: Date;
};

export type VideoMeeting = ReturnType<typeof mapVideoMeeting>;

export async function createDailyRoomForClass(
  input: CreateDailyRoomInput,
  client?: PoolClient
): Promise<void> {
  const db = client ?? pool;

  if (!dailyConfig.autoCreateRooms || !isDailyConfigured()) {
    await ensureDailyPlaceholder(input.classId, db);
    return;
  }

  const roomName = buildRoomName(input.classId);
  const roomExpiresAt = toUnixSeconds(input.endTime, 2 * 60 * 60);

  assertDailyExpiryIsFuture(roomExpiresAt, input.endTime);

  try {
    const payload = await dailyRequest<DailyRoomResponse>("/rooms", {
      method: "POST",
      body: {
        name: roomName,
        privacy: dailyConfig.roomPrivacy,
        properties: {
          exp: roomExpiresAt,
          eject_at_room_exp: true,
          max_participants: 4,
          enable_prejoin_ui: dailyConfig.enablePrejoinUi,
          enable_chat: dailyConfig.enableChat,
          enable_screenshare: true,
          start_video_off: false,
          start_audio_off: false,
          ...(dailyConfig.enableRecording === "off" ? {} : { enable_recording: dailyConfig.enableRecording })
        }
      }
    });

    await db.query(
      `
        INSERT INTO video_meetings (
          class_id,
          provider,
          provider_meeting_id,
          provider_room_name,
          provider_room_url,
          status,
          creation_status,
          raw_payload
        )
        VALUES ($1, 'daily', $2, $3, $4, 'scheduled', 'created', $5::JSONB)
        ON CONFLICT (class_id) DO UPDATE
        SET provider = 'daily',
            provider_meeting_id = EXCLUDED.provider_meeting_id,
            provider_room_name = EXCLUDED.provider_room_name,
            provider_room_url = EXCLUDED.provider_room_url,
            provider_password = NULL,
            status = EXCLUDED.status,
            creation_status = EXCLUDED.creation_status,
            raw_payload = EXCLUDED.raw_payload,
            updated_at = NOW()
      `,
      [input.classId, payload.id ?? payload.name, payload.name, payload.url, JSON.stringify(payload)]
    );
  } catch (error) {
    if (error instanceof ApiError) {
      await markDailyCreationFailed(input.classId, error.details ?? { message: error.message }, db);
      throw error;
    }

    await markDailyCreationFailed(input.classId, { message: "Daily request failed" }, db);
    throw new ApiError(502, "Daily room creation failed", "DAILY_CREATE_FAILED");
  }
}

export async function cancelDailyRoomForClass(classId: string, client?: PoolClient): Promise<void> {
  const db = client ?? pool;
  const result = await db.query<{ provider_room_name: string | null; creation_status: string }>(
    `
      SELECT provider_room_name, creation_status
      FROM video_meetings
      WHERE class_id = $1
      LIMIT 1
    `,
    [classId]
  );
  const meeting = result.rows[0];

  if (!meeting) {
    return;
  }

  if (dailyConfig.autoCreateRooms && isDailyConfigured() && meeting.provider_room_name && meeting.creation_status === "created") {
    const response = await fetch(`${getDailyApiBaseUrl()}/rooms/${encodeURIComponent(meeting.provider_room_name)}`, {
      method: "DELETE",
      headers: dailyHeaders()
    });

    if (!response.ok && response.status !== 404) {
      const payload = await response.json().catch(() => ({ message: "Daily room cancellation failed" }));
      throw new ApiError(502, "Daily room cancellation failed", "DAILY_CANCEL_FAILED", payload);
    }
  }

  await db.query(
    `
      UPDATE video_meetings
      SET status = 'cancelled',
          creation_status = CASE WHEN creation_status = 'created' THEN 'cancelled' ELSE creation_status END,
          updated_at = NOW()
      WHERE class_id = $1
    `,
    [classId]
  );
}

export async function createDailyRoomByClassId(classId: string): Promise<VideoMeeting> {
  const classResult = await pool.query<{
    id: string;
    title: string;
    start_time: Date;
    end_time: Date;
    duration_minutes: number;
  }>(
    `
      SELECT id, title, start_time, end_time, duration_minutes
      FROM classes
      WHERE id = $1
    `,
    [classId]
  );
  const classRow = classResult.rows[0];

  if (!classRow) {
    throw new ApiError(404, "Class not found", "CLASS_NOT_FOUND");
  }

  await createDailyRoomForClass({
    classId: classRow.id,
    topic: classRow.title,
    startTime: classRow.start_time,
    endTime: classRow.end_time,
    durationMinutes: classRow.duration_minutes
  });

  return await getVideoMeetingByClassId(classId);
}

export async function getVideoMeetingById(id: string): Promise<VideoMeeting> {
  const result = await pool.query<VideoMeetingRow>(
    `
      SELECT id, class_id, provider, provider_meeting_id, provider_room_name, provider_room_url, provider_password,
             status, creation_status, raw_payload, created_at, updated_at
      FROM video_meetings
      WHERE id = $1
         OR class_id = $1
    `,
    [id]
  );
  const meeting = result.rows[0];

  if (!meeting) {
    throw new ApiError(404, "Daily room not found", "DAILY_ROOM_NOT_FOUND");
  }

  return mapVideoMeeting(meeting);
}

export async function getVideoMeetingByClassId(classId: string): Promise<VideoMeeting> {
  const result = await pool.query<VideoMeetingRow>(
    `
      SELECT id, class_id, provider, provider_meeting_id, provider_room_name, provider_room_url, provider_password,
             status, creation_status, raw_payload, created_at, updated_at
      FROM video_meetings
      WHERE class_id = $1
    `,
    [classId]
  );
  const meeting = result.rows[0];

  if (!meeting) {
    throw new ApiError(404, "Daily room not found", "DAILY_ROOM_NOT_FOUND");
  }

  return mapVideoMeeting(meeting);
}

export async function createDailyJoinPayload(
  classId: string,
  user: AuthenticatedUser,
  requestedRole: 0 | 1 | undefined
): Promise<{
  provider: "daily";
  roomName: string;
  roomUrl: string;
  token: string;
  role: 0 | 1;
}> {
  if (!isDailyConfigured()) {
    throw new ApiError(503, "Daily is not configured", "DAILY_NOT_CONFIGURED");
  }

  await assertUserCanJoinDailyClass(classId, user);

  let meeting = await getVideoMeetingByClassId(classId).catch(async (error) => {
    if (error instanceof ApiError && error.code === "DAILY_ROOM_NOT_FOUND") {
      return await createDailyRoomByClassId(classId);
    }

    throw error;
  });

  if (!meeting.roomName || !meeting.roomUrl || meeting.creationStatus !== "created") {
    meeting = await createDailyRoomByClassId(classId);
  }

  if (!meeting.roomName || !meeting.roomUrl) {
    throw new ApiError(409, "Daily room has not been created yet", "DAILY_ROOM_NOT_CREATED");
  }

  await openDailyRoomForImmediateJoin(meeting.roomName, classId);

  const role = requestedRole === 1 && (user.roles.includes("admin") || user.roles.includes("teacher")) ? 1 : 0;

  const token = await createDailyMeetingToken(classId, meeting.roomName, user, role);

  return {
    provider: "daily",
    roomName: meeting.roomName,
    roomUrl: meeting.roomUrl,
    token,
    role
  };
}

export async function releaseClassroomForDaily(classId: string, user: AuthenticatedUser, role: 0 | 1): Promise<void> {
  await recordDailySessionEvent(classId, user, "leave");

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
        UPDATE video_meetings
        SET status = CASE
              WHEN EXISTS (SELECT 1 FROM classes c WHERE c.id = $1 AND c.end_time <= NOW()) THEN 'ended'::video_meeting_status
              ELSE 'scheduled'::video_meeting_status
            END,
            updated_at = NOW()
        WHERE class_id = $1
          AND status = 'started'
      `,
      [classId]
    );

    return;
  }

}

export async function endClassroomForDaily(classId: string, user: AuthenticatedUser): Promise<void> {
  const classResult = await pool.query<{ teacher_id: string }>("SELECT teacher_id FROM classes WHERE id = $1", [classId]);
  const classRow = classResult.rows[0];

  if (!classRow) {
    throw new ApiError(404, "Class not found", "CLASS_NOT_FOUND");
  }

  const canEndClass = classRow.teacher_id === user.id || user.roles.includes("admin");
  if (!canEndClass) {
    throw new ApiError(403, "Only the assigned teacher can end this class", "CLASS_END_NOT_ALLOWED");
  }

  if (classRow.teacher_id === user.id) {
    await recordDailySessionEvent(classId, user, "leave");
  }

  await pool.query(
    `
      UPDATE classes
      SET status = 'completed'::class_status,
          updated_at = NOW()
      WHERE id = $1
        AND status IN ('scheduled', 'rescheduled', 'live')
    `,
    [classId]
  );
  await pool.query(
    `
      UPDATE teacher_work_sessions
      SET status = 'completed',
          updated_at = NOW()
      WHERE class_id = $1
        AND status <> 'cancelled'
    `,
    [classId]
  );
  await pool.query(
    `
      UPDATE video_meetings
      SET status = 'ended'::video_meeting_status,
          updated_at = NOW()
      WHERE class_id = $1
        AND status <> 'cancelled'
    `,
    [classId]
  );

  await expireDailyRoomForEndedClass(classId);
}

export async function recordDailySessionEvent(
  classId: string,
  user: AuthenticatedUser,
  eventType: "join" | "leave"
): Promise<void> {
  const classResult = await pool.query<{ teacher_id: string; is_student: boolean }>(
    `
      SELECT c.teacher_id,
             EXISTS (
               SELECT 1
               FROM class_participants cp
               WHERE cp.class_id = c.id
                 AND cp.student_id = $2
             ) AS is_student
      FROM classes c
      WHERE c.id = $1
    `,
    [classId, user.id]
  );
  const classRow = classResult.rows[0];

  if (!classRow) {
    throw new ApiError(404, "Class not found", "CLASS_NOT_FOUND");
  }

  const isTeacher = classRow.teacher_id === user.id;
  const isAdmin = user.roles.includes("admin") || user.roles.includes("support");
  if (!isTeacher && !classRow.is_student && !isAdmin) {
    throw new ApiError(403, "You are not a participant in this class", "CLASS_ACCESS_DENIED");
  }

  await persistDailySessionEvent({
    classId,
    participantId: user.id,
    participantName: formatUserName(user),
    participantEmail: user.email,
    eventType,
    eventTime: new Date(),
    rawPayload: { source: "schooliedu_classroom", eventType, userId: user.id }
  });

  if (eventType === "join" && isTeacher) {
    await markClassLiveForDaily(classId);
  }
}

async function assertUserCanJoinDailyClass(classId: string, user: AuthenticatedUser): Promise<void> {
  const result = await pool.query<{
    teacher_id: string;
    start_time: Date;
    end_time: Date;
    status: string;
    is_student: boolean;
  }>(
    `
      SELECT c.teacher_id,
             c.start_time,
             c.end_time,
             c.status,
             EXISTS (
               SELECT 1
               FROM class_participants cp
               WHERE cp.class_id = c.id
                 AND cp.student_id = $2
             ) AS is_student
      FROM classes c
      WHERE c.id = $1
    `,
    [classId, user.id]
  );
  const classRow = result.rows[0];

  if (!classRow) {
    throw new ApiError(404, "Class not found", "CLASS_NOT_FOUND");
  }

  const isTeacher = classRow.teacher_id === user.id;
  const isAdmin = user.roles.includes("admin") || user.roles.includes("support");
  if (!isTeacher && !classRow.is_student && !isAdmin) {
    throw new ApiError(403, "You are not a participant in this class", "CLASS_ACCESS_DENIED");
  }

  if (!["scheduled", "rescheduled", "live"].includes(classRow.status)) {
    throw new ApiError(409, "This class is no longer available to join", "CLASS_NOT_JOINABLE");
  }

  const now = Date.now();
  const joinOpensAt = classRow.start_time.getTime() - 5 * 60 * 1000;
  if (now < joinOpensAt) {
    throw new ApiError(403, "This class can be joined only five minutes before its scheduled start time", "CLASS_JOIN_TOO_EARLY", {
      joinOpensAt: new Date(joinOpensAt).toISOString()
    });
  }

  if (now >= classRow.end_time.getTime()) {
    throw new ApiError(409, "This class has already ended", "CLASS_ALREADY_ENDED");
  }
}

export async function handleDailyWebhook(payload: any): Promise<unknown> {
  const eventName = String(payload?.type ?? payload?.event ?? "");

  if (eventName.includes("participant") && (eventName.includes("joined") || eventName.includes("left"))) {
    await storeDailyAttendanceEvent(payload);
  }

  return { received: true };
}

async function markClassLiveForDaily(classId: string): Promise<void> {
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
      UPDATE video_meetings
      SET status = 'started',
          updated_at = NOW()
      WHERE class_id = $1
        AND status IN ('pending', 'scheduled', 'started')
    `,
    [classId]
  );
}

async function createDailyMeetingToken(
  classId: string,
  roomName: string,
  user: AuthenticatedUser,
  role: 0 | 1
): Promise<string> {
  const classResult = await pool.query<{ start_time: Date; end_time: Date }>(
    "SELECT start_time, end_time FROM classes WHERE id = $1",
    [classId]
  );
  const classRow = classResult.rows[0];

  if (!classRow) {
    throw new ApiError(404, "Class not found", "CLASS_NOT_FOUND");
  }

  const tokenExpiresAt = toUnixSeconds(classRow.end_time, 2 * 60 * 60);

  assertDailyExpiryIsFuture(tokenExpiresAt, classRow.end_time);

  const payload = await dailyRequest<DailyTokenResponse>("/meeting-tokens", {
    method: "POST",
    body: {
      properties: {
        room_name: roomName,
        user_id: user.id,
        user_name: formatUserName(user),
        is_owner: role === 1,
        exp: tokenExpiresAt,
        eject_at_token_exp: true,
        enable_prejoin_ui: dailyConfig.enablePrejoinUi,
        permissions: buildDailyTokenPermissions(role)
      }
    }
  });

  return payload.token;
}

async function openDailyRoomForImmediateJoin(roomName: string, classId: string): Promise<void> {
  const classResult = await pool.query<{ end_time: Date }>("SELECT end_time FROM classes WHERE id = $1", [classId]);
  const classRow = classResult.rows[0];

  if (!classRow) {
    throw new ApiError(404, "Class not found", "CLASS_NOT_FOUND");
  }

  const roomExpiresAt = toUnixSeconds(classRow.end_time, 2 * 60 * 60);

  assertDailyExpiryIsFuture(roomExpiresAt, classRow.end_time);

  await dailyRequest<DailyRoomResponse>(`/rooms/${encodeURIComponent(roomName)}`, {
    method: "POST",
    body: {
      properties: {
        nbf: Math.floor(Date.now() / 1000) - 60,
        exp: roomExpiresAt
      }
    }
  });
}

async function expireDailyRoomForEndedClass(classId: string): Promise<void> {
  if (!isDailyConfigured()) {
    return;
  }

  const result = await pool.query<{ provider_room_name: string | null; creation_status: string }>(
    `
      SELECT provider_room_name, creation_status
      FROM video_meetings
      WHERE class_id = $1
    `,
    [classId]
  );
  const meeting = result.rows[0];

  if (!meeting?.provider_room_name || meeting.creation_status !== "created") {
    return;
  }

  await dailyRequest<DailyRoomResponse>(`/rooms/${encodeURIComponent(meeting.provider_room_name)}`, {
    method: "POST",
    body: {
      properties: {
        exp: Math.floor(Date.now() / 1000) + 1,
        eject_at_room_exp: true
      }
    }
  });
}

async function dailyRequest<T>(path: string, input: { method: string; body?: unknown }): Promise<T> {
  if (!isDailyConfigured()) {
    throw new ApiError(503, "Daily is not configured", "DAILY_NOT_CONFIGURED");
  }

  const response = await fetch(`${getDailyApiBaseUrl()}${path}`, {
    method: input.method,
    headers: dailyHeaders(),
    body: input.body === undefined ? undefined : JSON.stringify(input.body)
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string; info?: string };

  if (!response.ok) {
    throw new ApiError(502, "Daily API request failed", "DAILY_API_FAILED", payload);
  }

  return payload;
}

function dailyHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${dailyConfig.apiKey}`,
    "Content-Type": "application/json"
  };
}

async function ensureDailyPlaceholder(classId: string, db: PoolClient | typeof pool): Promise<void> {
  await db.query(
    `
      INSERT INTO video_meetings (class_id, provider, status, creation_status, raw_payload)
      VALUES ($1, 'daily', 'pending', 'skipped', '{}'::JSONB)
      ON CONFLICT (class_id) DO NOTHING
    `,
    [classId]
  );
}

async function markDailyCreationFailed(
  classId: string,
  payload: unknown,
  db: PoolClient | typeof pool
): Promise<void> {
  await db.query(
    `
      INSERT INTO video_meetings (class_id, provider, status, creation_status, raw_payload)
      VALUES ($1, 'daily', 'failed', 'failed', $2::JSONB)
      ON CONFLICT (class_id) DO UPDATE
      SET provider = 'daily',
          status = 'failed',
          creation_status = 'failed',
          raw_payload = EXCLUDED.raw_payload,
          updated_at = NOW()
    `,
    [classId, JSON.stringify(payload)]
  );
}

async function storeDailyAttendanceEvent(payload: any): Promise<void> {
  const roomName =
    payload?.payload?.room_name ??
    payload?.payload?.room ??
    payload?.payload?.roomName ??
    payload?.room_name ??
    payload?.room;

  if (!roomName) {
    return;
  }

  const meeting = await pool.query<{ class_id: string }>(
    "SELECT class_id FROM video_meetings WHERE provider_room_name = $1",
    [roomName]
  );
  const classId = meeting.rows[0]?.class_id;

  if (!classId) {
    return;
  }

  const eventName = String(payload?.type ?? payload?.event ?? "");
  const participant = payload?.payload?.participant ?? payload?.participant ?? {};
  const eventType = eventName.includes("left") ? "leave" : "join";
  const participantId = participant.user_id ?? participant.session_id ?? null;
  const eventTime = payload?.payload?.timestamp ? new Date(payload.payload.timestamp) : new Date();

  await persistDailySessionEvent({
    classId,
    participantId,
    participantName: participant.user_name ?? participant.name ?? null,
    participantEmail: participant.email ?? null,
    eventType,
    eventTime,
    rawPayload: payload
  });
}

async function persistDailySessionEvent(input: {
  classId: string;
  participantId: string | null;
  participantName: string | null;
  participantEmail: string | null;
  eventType: "join" | "leave";
  eventTime: Date;
  rawPayload: unknown;
}): Promise<void> {
  await pool.query(
    `
      INSERT INTO video_attendance_events (
        class_id,
        student_id,
        provider,
        provider_participant_id,
        participant_name,
        participant_email,
        event_type,
        event_time,
        raw_payload
      )
      SELECT
        $1,
        (
          SELECT student_id
          FROM class_participants
          WHERE class_id = $1
            AND student_id::TEXT = $2
          LIMIT 1
        ),
        'daily', $2, $3, $4, $5, $6, $7::JSONB
      WHERE NOT EXISTS (
        SELECT 1
        FROM (
          SELECT event_type
          FROM video_attendance_events
          WHERE class_id = $1
            AND provider = 'daily'
            AND provider_participant_id IS NOT DISTINCT FROM $2
          ORDER BY created_at DESC
          LIMIT 1
        ) AS latest_event
        WHERE latest_event.event_type = $5::video_event_type
      )
    `,
    [
      input.classId,
      input.participantId,
      input.participantName,
      input.participantEmail,
      input.eventType,
      input.eventTime,
      JSON.stringify(input.rawPayload)
    ]
  );

  if (!input.participantId) {
    return;
  }

  await pool.query(
    `
      UPDATE class_participants
      SET joined_at = CASE
            WHEN $3 = 'join' THEN COALESCE(joined_at, $4)
            ELSE joined_at
          END,
          left_at = CASE
            WHEN $3 = 'leave' THEN $4
            ELSE left_at
          END,
          updated_at = NOW()
      WHERE class_id = $1
        AND student_id::TEXT = $2
    `,
    [input.classId, input.participantId, input.eventType, input.eventTime]
  );
}

function mapVideoMeeting(row: VideoMeetingRow) {
  return {
    id: row.id,
    classId: row.class_id,
    provider: row.provider,
    providerMeetingId: row.provider_meeting_id,
    roomName: row.provider_room_name,
    roomUrl: row.provider_room_url ?? fallbackRoomUrl(row.provider_room_name),
    status: row.status,
    creationStatus: row.creation_status,
    rawPayload: row.raw_payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function fallbackRoomUrl(roomName: string | null): string | null {
  const domainUrl = getDailyDomainUrl();

  return domainUrl && roomName ? `${domainUrl}/${roomName}` : null;
}

function buildRoomName(classId: string): string {
  const suffix = crypto.randomBytes(4).toString("hex");

  return `schooli-${classId.replace(/-/g, "")}-${suffix}`.slice(0, 128);
}

function toUnixSeconds(date: Date, offsetSeconds = 0): number {
  return Math.floor(date.getTime() / 1000) + offsetSeconds;
}

function assertDailyExpiryIsFuture(expiresAt: number, endTime: Date): void {
  const now = Math.floor(Date.now() / 1000);

  if (expiresAt <= now) {
    throw new ApiError(400, "Class has already ended and cannot create a Daily room", "DAILY_ROOM_EXPIRED", {
      classEndTime: endTime.toISOString(),
      expiresAt
    });
  }
}

function buildDailyTokenPermissions(role: 0 | 1): Record<string, unknown> {
  return {
    hasPresence: true,
    canSend: true,
    canReceive: { base: true },
    ...(role === 1 ? { canAdmin: ["participants"] } : {})
  };
}

function formatUserName(user: AuthenticatedUser): string {
  const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();

  return fullName || user.username || user.email || "Schooli User";
}
