-- ============================================
-- Fix RLS Policy and Consolidate `wraps` Table
-- ============================================

-- 1. 更新 wraps 表结构
-- 使 slug 可为空 (AI 生成的作品最初没有 slug)
ALTER TABLE wraps ALTER COLUMN slug DROP NOT NULL;

-- 添加缺失的字段
ALTER TABLE wraps ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE wraps ADD COLUMN IF NOT EXISTS prompt TEXT;
ALTER TABLE wraps ADD COLUMN IF NOT EXISTS model_slug TEXT;
ALTER TABLE wraps ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE wraps ADD COLUMN IF NOT EXISTS author_name TEXT;

-- 2. 添加索引以提高性能
CREATE INDEX IF NOT EXISTS idx_wraps_user_id ON wraps(user_id);
CREATE INDEX IF NOT EXISTS idx_wraps_model_slug ON wraps(model_slug);
CREATE INDEX IF NOT EXISTS idx_wraps_deleted_at ON wraps(deleted_at) WHERE deleted_at IS NULL;

-- 3. 更新 RLS 策略
-- 移除旧的策略
DROP POLICY IF EXISTS "Public Read" ON wraps;

-- 创建新的策略
-- 所有人可以查看公开的作品，用户可以查看自己的作品
CREATE POLICY "Public Read" ON wraps 
FOR SELECT USING (
  (is_public = true AND (deleted_at IS NULL OR category = 'official')) 
  OR auth.uid() = user_id
);

-- 允许用户插入自己的作品
CREATE POLICY "Insert Own" ON wraps 
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 允许用户修改自己的作品 (例如：发布/下架、修改名称)
CREATE POLICY "Update Own" ON wraps 
FOR UPDATE USING (auth.uid() = user_id);

-- 允许用户删除自己的作品 (硬删除或软删除权限)
CREATE POLICY "Delete Own" ON wraps 
FOR DELETE USING (auth.uid() = user_id);
