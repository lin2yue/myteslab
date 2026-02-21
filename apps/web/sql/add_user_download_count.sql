-- Add user_download_count and backfill with historical download_count

ALTER TABLE wraps
ADD COLUMN IF NOT EXISTS user_download_count INTEGER;

UPDATE wraps
SET user_download_count = COALESCE(user_download_count, download_count, 0);

ALTER TABLE wraps
ALTER COLUMN user_download_count SET DEFAULT 0,
ALTER COLUMN user_download_count SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wraps_is_public_user_download_count
ON wraps(is_public, user_download_count DESC);

-- Keep actual download_count, but also track/display user_download_count
CREATE OR REPLACE FUNCTION increment_download_count(wrap_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE wraps
  SET download_count = COALESCE(download_count, 0) + 1,
      user_download_count = COALESCE((
        SELECT COUNT(DISTINCT ud.user_id)::int
        FROM user_downloads ud
        WHERE ud.wrap_id = increment_download_count.wrap_id
      ), 0)
  WHERE id = wrap_id;
END;
$$ LANGUAGE plpgsql;
