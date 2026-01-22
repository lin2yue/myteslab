-- ============================================
-- 终极诊断与数据抢救脚本
-- ============================================

-- 1. 数据总量透视：看看迁移到底进去了多少？
SELECT 
    category, 
    count(*) as total, 
    count(*) filter (where deleted_at is not null) as deleted,
    count(*) filter (where is_public = true) as public,
    count(user_id) as with_user_id
FROM wraps 
GROUP BY category;

-- 2. 尝试抢救：清除所有社区作品的“删除标记”和“隐藏状态”
-- 有时由于迁移脚本的逻辑，可能会把数据标记为已删除
UPDATE wraps 
SET deleted_at = NULL, is_active = true 
WHERE category = 'community';

-- 3. 检查当前用户的“真正”记录
-- 注意：这个查询在 SQL Editor 查不到 auth.uid() 没关系，只要看到输出就行
SELECT id, user_id, name, created_at, category 
FROM wraps 
WHERE category = 'community' 
ORDER BY created_at DESC 
LIMIT 20;

-- 4. 彻底重载 RLS 策略 (以防之前的修改由于某种原因没生效)
ALTER TABLE wraps DISABLE ROW LEVEL SECURITY;
ALTER TABLE wraps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wraps_unified_select" ON wraps;
CREATE POLICY "wraps_unified_select" ON wraps 
FOR SELECT USING (
  (is_public = true AND (deleted_at IS NULL OR category = 'official')) 
  OR (auth.uid() = user_id)
);
