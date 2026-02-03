-- Add wrap_id to generation_tasks for linking task -> wrap
ALTER TABLE generation_tasks
ADD COLUMN IF NOT EXISTS wrap_id UUID REFERENCES wraps(id) ON DELETE SET NULL;
