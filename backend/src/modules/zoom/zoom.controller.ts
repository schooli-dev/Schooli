import type { Request, RequestHandler } from "express";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import * as zoomService from "./zoom.service.js";

export const createMeeting: RequestHandler = asyncHandler(async (req, res) => {
  const meeting = await zoomService.createZoomMeetingByClassId(req.body.classId);

  sendSuccess(res, {
    statusCode: 201,
    message: "Zoom meeting created",
    data: meeting
  });
});

export const getMeeting: RequestHandler = asyncHandler(async (req, res) => {
  const meeting = await zoomService.getZoomMeetingById(getIdParam(req));

  sendSuccess(res, {
    message: "Zoom meeting fetched",
    data: meeting
  });
});

export const webhook: RequestHandler = asyncHandler(async (req, res) => {
  zoomService.verifyZoomWebhook(req.headers, (req as Request & { rawBody?: string }).rawBody ?? req.body);
  const data = await zoomService.handleZoomWebhook(req.body);

  res.status(200).json(data);
});

export const signature: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const meeting = await zoomService.getJoinableZoomMeetingByClassId(getIdParam(req));

  if (!meeting.zoomMeetingId) {
    throw new ApiError(409, "Zoom meeting has not been created yet", "ZOOM_MEETING_NOT_CREATED");
  }

  const requestedRole = req.body.role ?? 0;
  const role = requestedRole === 1 && (req.user.roles.includes("admin") || req.user.roles.includes("teacher")) ? 1 : 0;

  if (role === 1) {
    await zoomService.markClassLiveForMeetingSdk(getIdParam(req));
  } else {
    const liveClass = await zoomService.getOtherLiveDefaultHostClass(getIdParam(req));

    if (liveClass) {
      throw new ApiError(
        409,
        `Another Zoom class is already in progress on the default host: ${liveClass.title}. Please join the same scheduled class, or wait until the active meeting ends.`,
        "ZOOM_DEFAULT_HOST_BUSY",
        {
          activeClassId: liveClass.id,
          activeMeetingNumber: liveClass.zoom_meeting_id
        }
      );
    }
  }

  const data = zoomService.createMeetingSdkSignature(meeting.zoomMeetingId, role);
  const zak = role === 1 ? await zoomService.getZoomHostZak() : undefined;

  sendSuccess(res, {
    message: "Zoom Meeting SDK signature created",
    data: {
      ...data,
      meetingNumber: meeting.zoomMeetingId,
      password: meeting.zoomPassword,
      zak,
      role
    }
  });
});

export const leave: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }

  const requestedRole = req.body.role ?? 0;
  const role = requestedRole === 1 && (req.user.roles.includes("admin") || req.user.roles.includes("teacher")) ? 1 : 0;

  await zoomService.releaseClassroomForMeetingSdk(getIdParam(req), req.user.id, role);

  sendSuccess(res, {
    message: "Classroom session released",
    data: {
      classId: getIdParam(req),
      role
    }
  });
});

function getIdParam(req: Request): string {
  const id = req.params.id;

  return Array.isArray(id) ? id[0] : id;
}
