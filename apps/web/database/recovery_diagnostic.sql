-- ============================================
-- 诊断与修复脚本：解决历史记录不显示问题
-- ============================================

-- 1. 数据对齐检查：确保 wraps 表中的 user_id 与 auth.users 匹配
-- 有时迁移过来的 user_id 可能存在格式问题或为空
UPDATE wraps 
SET category = 'community' 
WHERE user_id IS NOT NULL AND category = 'official';

-- 2. 核心修复：彻底重新配置 wraps 表的 RLS 策略
-- 之前的策略名可能不统一导致冲突或未生效
ALTER TABLE wraps ENABLE ROW LEVEL SECURITY;

-- 移除所有可能存在的旧策略（清理冲突）
DROP POLICY IF EXISTS "Public Read" ON wraps;
DROP POLICY IF EXISTS "Public Read Wraps" ON wraps;
DROP POLICY IF EXISTS "Insert Own" ON wraps;
DROP POLICY IF EXISTS "Update Own" ON wraps;
DROP POLICY IF EXISTS "Delete Own" ON wraps;
DROP POLICY IF EXISTS "Users can view own wraps" ON wraps;
DROP POLICY IF EXISTS "Users can insert their own wraps" ON wraps;

-- 重新创建最简且正确的策略
-- 所有人可以查看公开的作品，且能看到官方作品
CREATE POLICY "wraps_select_policy" ON wraps 
FOR SELECT USING (
  (is_public = true AND (deleted_at IS NULL OR category = 'official')) 
  OR auth.uid() = user_id
);

CREATE POLICY "wraps_insert_policy" ON wraps 
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "wraps_update_policy" ON wraps 
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "wraps_delete_policy" ON wraps 
FOR DELETE USING (auth.uid() = user_id);

-- 3. 诊断查询 (请在 SQL Editor 执行后查看结果)
-- 检查当前用户是否有记录 (在 SQL Editor 中可能会返回 0，因为 auth.uid() 在那里默认不同)
SELECT count(*) as total_wraps_count FROM wraps;
SELECT count(*) as own_wraps_count FROM wraps WHERE user_id = auth.uid();
SELECT count(*) as public_wraps_count FROM wraps WHERE is_public = true;

-- 4. 容错处理：确保 deleted_at 默认值为 NULL
ALTER TABLE wraps ALTER COLUMN deleted_at SET DEFAULT NULL;
UPDATE wraps SET deleted_at = NULL WHERE deleted_at IS NOT NULL AND deleted_at > now(); -- 防止未来时间戳导致的过滤
