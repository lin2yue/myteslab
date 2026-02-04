-- Fix NULL download_count values and enforce non-null default
BEGIN;

UPDATE wraps
SET download_count = 0
WHERE download_count IS NULL;

-- One-time backfill: add logged-in download history on top of existing count
WITH agg AS (
  SELECT wrap_id, COUNT(*)::int AS cnt
  FROM user_downloads
  GROUP BY wrap_id
)
UPDATE wraps AS w
SET download_count = COALESCE(w.download_count, 0) + agg.cnt
FROM agg
WHERE w.id = agg.wrap_id;

ALTER TABLE wraps
  ALTER COLUMN download_count SET DEFAULT 0,
  ALTER COLUMN download_count SET NOT NULL;

COMMIT;
