-- Allow users to update their own generated wraps (e.g. for is_public)
CREATE POLICY "Users can update their own generated wraps"
ON generated_wraps FOR UPDATE
USING (auth.uid() = user_id);

-- Allow users to delete their own generated wraps
CREATE POLICY "Users can delete their own generated wraps"
ON generated_wraps FOR DELETE
USING (auth.uid() = user_id);
