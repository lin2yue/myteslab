-- ============================================
-- 深度诊断脚本：查找消失的历史记录
-- ============================================

-- 1. 总体统计
SELECT 
    count(*) as total_count,
    count(user_id) as count_with_user_id,
    count(*) filter (where is_public = true) as public_count,
    count(*) filter (where deleted_at is not null) as deleted_count
FROM wraps;

-- 2. 检查当前用户的匹配情况
-- 注意：在 SQL Editor 中 auth.uid() 可能不等于你在页面登录的 UID
-- 我们直接查找最近产生的带 user_id 的记录
SELECT 
    id, 
    user_id, 
    name, 
    category, 
    is_public, 
    deleted_at, 
    created_at 
FROM wraps 
WHERE user_id IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 10;

-- 3. 检查 RLS 是否真的开启且没有排除当前用户
-- 运行此查询查看生效的策略
SELECT * FROM pg_policies WHERE tablename = 'wraps';

-- 4. 尝试修复：如果是因为 user_id 记录在迁移中出现了类型或空值问题
-- 确保所有从 generated_wraps 过来的记录都没有被错误标记
-- 我们可以临时关闭 RLS 看看数据是否能出来（仅用于测试）
-- ALTER TABLE wraps DISABLE ROW LEVEL SECURITY; 
-- (不建议在生产环境执行，先看上面的查询结果)
