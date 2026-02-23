-- Add wraps prompt search indexes
CREATE INDEX IF NOT EXISTS idx_wraps_prompt_search ON wraps USING gin (prompt gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_wraps_prompt_plain ON wraps(prompt);
