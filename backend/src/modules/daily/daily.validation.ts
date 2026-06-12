import { z } from "zod";

const uuid = z.string().uuid();

export const createDailyRoomSchema = z.object({
  body: z.object({
    classId: uuid
  })
});

export const getDailyRoomSchema = z.object({
  params: z.object({
    id: uuid
  })
});

export const dailyJoinSchema = z.object({
  params: z.object({
    id: uuid
  }),
  body: z.object({
    role: z.union([z.literal(0), z.literal(1)]).optional()
  })
});

export const dailyLeaveSchema = z.object({
  params: z.object({
    id: uuid
  }),
  body: z.object({
    role: z.union([z.literal(0), z.literal(1)]).optional()
  })
});

export type CreateDailyRoomInput = z.infer<typeof createDailyRoomSchema>["body"];
