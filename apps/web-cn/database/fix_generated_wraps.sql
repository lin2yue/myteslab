-- 为 generated_wraps 表添加缺失的列
ALTER TABLE generated_wraps ADD COLUMN IF NOT EXISTS model_slug TEXT;
ALTER TABLE generated_wraps ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE generated_wraps ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0;

-- 添加索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_generated_wraps_model_slug ON generated_wraps(model_slug);
CREATE INDEX IF NOT EXISTS idx_generated_wraps_is_public ON generated_wraps(is_public);

-- 核心修复：添加 RLS 更新权限 (之前缺失导致无法设置为公开)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'generated_wraps' 
        AND policyname = 'Users can update their own generated wraps'
    ) THEN
        CREATE POLICY "Users can update their own generated wraps" ON generated_wraps 
        FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END $$;
