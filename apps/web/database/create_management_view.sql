-- ============================================
-- 创建管理视图：带邮箱的积分查看
-- ============================================

-- 创建一个视图，将积分表和个人资料表（包含邮箱）关联起来
-- 这样你就可以在 Table Editor 侧边栏的 Views 分组里直接看到谁有多少分
CREATE OR REPLACE VIEW manager_user_view AS
SELECT 
    p.email,
    c.user_id,
    c.balance,
    c.total_earned,
    c.total_spent,
    c.updated_at
FROM user_credits c
JOIN profiles p ON c.user_id = p.id;

-- 如果你想在原来的 user_credits 表里直接看到（通过外键关联显示）
-- Supabase 表编辑器通常会自动识别 profiles 表的 email 作为 display column
-- 如果没有自动显示，建议直接查看上面创建的 manager_user_view
