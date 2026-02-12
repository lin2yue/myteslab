-- ============================================
-- Rollback for add_generation_pipeline_hardening.sql
-- WARNING:
-- 1) This removes worker-related columns and idempotency unique indexes.
-- 2) Execute only when application code has already rolled back.
-- ============================================

BEGIN;

DROP INDEX IF EXISTS uq_credit_ledger_task_generation_charge_once;
DROP INDEX IF EXISTS uq_credit_ledger_task_refund_once;
DROP INDEX IF EXISTS idx_generation_tasks_user_status_updated_at;
DROP INDEX IF EXISTS idx_generation_tasks_status_lease_retry;
DROP INDEX IF EXISTS idx_wraps_generation_task_user_id;
DROP INDEX IF EXISTS idx_credit_ledger_task_created_at;

ALTER TABLE generation_tasks
  DROP CONSTRAINT IF EXISTS generation_tasks_version_non_negative,
  DROP CONSTRAINT IF EXISTS generation_tasks_attempts_non_negative,
  DROP COLUMN IF EXISTS error_code,
  DROP COLUMN IF EXISTS version,
  DROP COLUMN IF EXISTS attempts,
  DROP COLUMN IF EXISTS lease_owner,
  DROP COLUMN IF EXISTS lease_expires_at,
  DROP COLUMN IF EXISTS next_retry_at,
  DROP COLUMN IF EXISTS started_at,
  DROP COLUMN IF EXISTS finished_at;

COMMIT;
