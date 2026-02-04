-- ============================================
-- 用户 ID 匹配与可见性深度排查
-- ============================================

-- 1. 查看当前用户的 UID (在 SQL Editor 运行时)
-- 注意：如果你是在 Supabase Dashboard 运行，这个值可能不是你在前端登录的值
SELECT auth.uid() as current_editor_uid;

-- 2. 查找数据库中所有的用户 ID (去重)
-- 看看有没有你熟悉的那个 ID
SELECT DISTINCT user_id FROM wraps WHERE user_id IS NOT NULL;

-- 3. 统计你的记录 (如果你知道了自己的 UID，把下面的 UUID 替换掉手动查一下)
-- SELECT count(*) FROM wraps WHERE user_id = '你的-UID-填在这里';

-- 4. 检查是否有记录被错误过滤
-- 列出所有 community 记录的状态，看看是否有奇怪的标志
SELECT 
    id, 
    name, 
    is_public, 
    is_active, 
    deleted_at, 
    user_id 
FROM wraps 
WHERE category = 'community' 
ORDER BY created_at DESC 
LIMIT 10;

-- 5. 极端测试：临时允许所有人查看所有 community 记录
-- 如果运行这个后页面出现了记录，那 100% 是 RLS 或 UID 匹配问题
-- 注意：这仅用于 1 分钟测试，测试完请还原
-- DROP POLICY IF EXISTS "wraps_test_all" ON wraps;
-- CREATE POLICY "wraps_test_all" ON wraps FOR SELECT USING (category = 'community');
