-- ============================================
-- 修复 Supabase Security Linter 报警项
-- 1. 修复 security_definer_view: user_credits_overview 应该是 SECURITY INVOKER
-- 2. 修复 rls_disabled_in_public: webhook_logs 应该启用 RLS
-- ============================================

-- 1. 更新视图为安全性更高的 INVOKER 模式
-- 在 Postgres 15+ 中可以使用 WITH (security_invoker = true)
-- 这样该视图在被访问时会强制执行基础表的 RLS 策略
CREATE OR REPLACE VIEW public.user_credits_overview 
WITH (security_invoker = true)
AS
SELECT 
    profiles.id,
    profiles.email,
    profiles.display_name,
    COALESCE(user_credits.balance, 0) AS balance,
    COALESCE(user_credits.total_spent, 0) AS total_consumed,
    profiles.created_at
FROM 
    profiles
LEFT JOIN 
    user_credits ON profiles.id = user_credits.user_id;

-- 2. 为 webhook_logs 开启 RLS
ALTER TABLE IF EXISTS public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- 3. 配置 webhook_logs 的访问策略
-- [NOTE] 管理端通常使用 service_role 访问，不受 RLS 限制。
-- 这里我们为了通过 Linter，确保至少开启了 RLS 且没有任何公共访问权限。
DROP POLICY IF EXISTS "Service role only access" ON public.webhook_logs;
-- 默认情况下，开启 RLS 后如果没有策略，普通角色将无法访问，这符合安全要求。

-- 如果需要允许管理员查看，可以添加如下策略（假设 profile 表中有 role 字段）
-- CREATE POLICY "Admins can view webhook logs" ON public.webhook_logs
-- FOR SELECT TO authenticated
-- USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')));
