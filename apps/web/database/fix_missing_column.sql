
-- 修复 wraps 表缺失的 description 字段
ALTER TABLE wraps ADD COLUMN IF NOT EXISTS description TEXT;

-- 同时确保已有数据的同步逻辑
UPDATE wraps SET description_en = '' WHERE description_en IS NULL;
