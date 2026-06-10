import { z } from "zod";

const uuid = z.string().uuid();

export const createZoomMeetingSchema = z.object({
  body: z.object({
    classId: uuid
  })
});

export const getZoomMeetingSchema = z.object({
  params: z.object({
    id: uuid
  })
});

export const zoomSignatureSchema = z.object({
  params: z.object({
    id: uuid
  }),
  body: z.object({
    role: z.union([z.literal(0), z.literal(1)]).optional()
  })
});

export const zoomLeaveSchema = z.object({
  params: z.object({
    id: uuid
  }),
  body: z.object({
    role: z.union([z.literal(0), z.literal(1)]).optional()
  })
});

export type CreateZoomMeetingInput = z.infer<typeof createZoomMeetingSchema>["body"];
export type ZoomSignatureInput = z.infer<typeof zoomSignatureSchema>["body"];
