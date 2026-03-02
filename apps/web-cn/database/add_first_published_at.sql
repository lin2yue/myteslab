-- 给 wraps 表添加 first_published_at 字段
-- 用于记录作品首次发布时间，供列表页"最新"排序使用

ALTER TABLE wraps
  ADD COLUMN IF NOT EXISTS first_published_at TIMESTAMP WITH TIME ZONE;

-- 对已有的公开作品，用 updated_at 作为首次发布时间的兜底值
-- (created_at 是生成时间，updated_at 在发布时会被更新，更接近发布时间)
UPDATE wraps
SET first_published_at = updated_at
WHERE is_public = true AND first_published_at IS NULL;

-- 为排序查询添加索引
CREATE INDEX IF NOT EXISTS idx_wraps_first_published_at
  ON wraps (first_published_at DESC)
  WHERE first_published_at IS NOT NULL;
