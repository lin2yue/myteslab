-- ============================================
-- 终极修复脚本：强制统合冲突的 RLS 策略
-- ============================================

-- 1. 彻底清除所有历史遗留策略（根据诊断截图中发现的所有名称）
DROP POLICY IF EXISTS "Allow public read access on wraps" ON wraps;
DROP POLICY IF EXISTS "public read wraps" ON wraps;
DROP POLICY IF EXISTS "wraps_select_policy" ON wraps;
DROP POLICY IF EXISTS "Public Read" ON wraps;
DROP POLICY IF EXISTS "Public Read Wraps" ON wraps;
DROP POLICY IF EXISTS "View Own" ON wraps;
DROP POLICY IF EXISTS "View Public" ON wraps;

-- 2. 重新创建唯一的 SELECT 策略
-- 逻辑：(是公开的 且 (没被软删除 或 是官方的)) 或者 是当前用户自己的
CREATE POLICY "wraps_unified_select" ON wraps 
FOR SELECT USING (
  (is_public = true AND (deleted_at IS NULL OR category = 'official')) 
  OR (auth.uid() = user_id)
);

-- 3. 确保 is_active 字段不会意外拦截（如果代码中有用到，设为 true）
UPDATE wraps SET is_active = true WHERE is_active IS FALSE OR is_active IS NULL;

-- 4. 辅助检查：查看迁移过来的数据 user_id 是否正确
-- 如果发现大量 user_id 为空，说明迁移脚本的 user_id 没对上
SELECT count(*) as count_with_null_user FROM wraps WHERE user_id IS NULL AND category = 'community';
