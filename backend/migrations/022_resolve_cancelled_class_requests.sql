-- Older direct admin cancellations could leave an associated cancellation request pending.
-- Resolve those historical requests so request queues and audit data match the class outcome.
UPDATE class_cancellation_requests AS request
SET status = 'approved',
    admin_note = COALESCE(request.admin_note, class.cancellation_reason),
    reviewed_at = COALESCE(request.reviewed_at, class.cancelled_at, NOW()),
    updated_at = NOW()
FROM classes AS class
WHERE request.class_id = class.id
  AND class.status = 'cancelled'
  AND request.status = 'pending';
