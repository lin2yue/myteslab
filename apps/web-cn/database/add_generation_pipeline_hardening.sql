-- ============================================
-- PR1: Generation Pipeline Data Hardening
-- Scope:
-- 1) Add worker-friendly task fields
-- 2) Add query/perf indexes for task polling and recovery
-- 3) Add ledger idempotency unique constraints (with duplicate cleanup)
-- ============================================

BEGIN;

-- 1) generation_tasks: worker/runtime fields
ALTER TABLE generation_tasks
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lease_owner TEXT,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS error_code TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'generation_tasks_version_non_negative'
  ) THEN
    ALTER TABLE generation_tasks
      ADD CONSTRAINT generation_tasks_version_non_negative CHECK (version >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'generation_tasks_attempts_non_negative'
  ) THEN
    ALTER TABLE generation_tasks
      ADD CONSTRAINT generation_tasks_attempts_non_negative CHECK (attempts >= 0);
  END IF;
END $$;

-- Backfill helper timestamps for historical rows
UPDATE generation_tasks
SET started_at = COALESCE(started_at, created_at)
WHERE started_at IS NULL
  AND status IN ('processing', 'completed', 'failed', 'failed_refunded');

UPDATE generation_tasks
SET finished_at = COALESCE(finished_at, updated_at, created_at)
WHERE finished_at IS NULL
  AND status IN ('completed', 'failed', 'failed_refunded');

-- 2) Performance indexes
CREATE INDEX IF NOT EXISTS idx_generation_tasks_user_status_updated_at
  ON generation_tasks(user_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_generation_tasks_status_lease_retry
  ON generation_tasks(status, lease_expires_at, next_retry_at);

CREATE INDEX IF NOT EXISTS idx_wraps_generation_task_user_id
  ON wraps(generation_task_id, user_id);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_task_created_at
  ON credit_ledger(task_id, created_at DESC);

-- 3) Ledger idempotency safety:
-- Keep earliest row, drop extra duplicates before adding unique indexes.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY task_id ORDER BY created_at ASC, id ASC) AS rn
  FROM credit_ledger
  WHERE task_id IS NOT NULL
    AND type IN ('generation', 'generation_charge')
)
DELETE FROM credit_ledger cl
USING ranked r
WHERE cl.id = r.id
  AND r.rn > 1;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY task_id ORDER BY created_at ASC, id ASC) AS rn
  FROM credit_ledger
  WHERE task_id IS NOT NULL
    AND type = 'refund'
)
DELETE FROM credit_ledger cl
USING ranked r
WHERE cl.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_ledger_task_generation_charge_once
  ON credit_ledger(task_id)
  WHERE task_id IS NOT NULL
    AND type IN ('generation', 'generation_charge');

CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_ledger_task_refund_once
  ON credit_ledger(task_id)
  WHERE task_id IS NOT NULL
    AND type = 'refund';

COMMIT;
