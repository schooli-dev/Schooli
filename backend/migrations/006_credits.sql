DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_transaction_type') THEN
    CREATE TYPE credit_transaction_type AS ENUM (
      'admin_adjustment',
      'teacher_grant',
      'class_consumption',
      'refund',
      'payment_purchase_future'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_approval_status') THEN
    CREATE TYPE credit_approval_status AS ENUM (
      'pending',
      'approved',
      'rejected'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS credits_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount NUMERIC(10, 2) NOT NULL,
  balance_after NUMERIC(10, 2) NOT NULL,
  transaction_type credit_transaction_type NOT NULL,
  reason TEXT NOT NULL,
  source_role TEXT NOT NULL,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  approval_status credit_approval_status NOT NULL DEFAULT 'approved',
  approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credits_ledger_student_created
  ON credits_ledger (student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credits_ledger_type
  ON credits_ledger (transaction_type);

CREATE INDEX IF NOT EXISTS idx_credits_ledger_approval
  ON credits_ledger (approval_status);
