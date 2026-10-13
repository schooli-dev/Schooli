import { z } from "zod";

const isoDateTime = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: "Expected a valid ISO date-time"
});

// Query strings: "actions" may be repeated or comma separated.
const actionList = z.preprocess(
  (value) => (typeof value === "string" ? value.split(",").map((item) => item.trim()).filter(Boolean) : value),
  z.array(z.string().max(80)).max(30).optional()
);

export const listAuditLogsSchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    module: z.string().trim().max(60).optional(),
    actions: actionList,
    from: isoDateTime.optional(),
    to: isoDateTime.optional(),
    search: z.string().trim().max(120).optional(),
    entityId: z.string().uuid().optional(),
    actorRole: z.enum(["admin", "teacher", "student", "support"]).optional(),
    sort: z.enum(["asc", "desc"]).optional()
  })
});

export type ListAuditLogsInput = z.infer<typeof listAuditLogsSchema>["query"];
