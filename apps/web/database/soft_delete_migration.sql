-- 1. Add deleted_at column to generated_wraps
ALTER TABLE generated_wraps ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- 2. Update RLS Policy for Viewing Wraps (Filter out deleted ones)
-- We drop the existing policy and recreate it to include the deleted_at check
DROP POLICY IF EXISTS "Users can view their own generated wraps" ON generated_wraps;
CREATE POLICY "Users can view their own generated wraps" 
ON generated_wraps FOR SELECT 
USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Note: The "Public can view public generated wraps" policy should also filter deleted ones
DROP POLICY IF EXISTS "Public can view public generated wraps" ON generated_wraps;
CREATE POLICY "Public can view public generated wraps" 
ON generated_wraps FOR SELECT 
USING (is_public = true AND deleted_at IS NULL);

-- We don't need to change UPDATE/DELETE policies significantly because:
-- 1. UPDATE policy "Users can update their own generated wraps" (auth.uid() = user_id) allows setting deleted_at.
-- 2. DELETE policy "Users can delete their own generated wraps" is still there, but we will stop using it in the app code.
