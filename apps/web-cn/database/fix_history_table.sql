-- 为 generated_wraps 增加车型字段
ALTER TABLE generated_wraps ADD COLUMN IF NOT EXISTS model_slug TEXT;

-- 允许用户插入自己的生成记录 (RLS)
DROP POLICY IF EXISTS "Users can insert their own wraps" ON generated_wraps;
CREATE POLICY "Users can insert their own wraps" ON generated_wraps FOR INSERT WITH CHECK (auth.uid() = user_id);
