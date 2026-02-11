-- 创建或替换视图
CREATE OR REPLACE VIEW user_credits_overview 
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


-- 授予权限 (适配 Supabase Dashboard 使用)
GRANT SELECT ON user_credits_overview TO authenticated;
GRANT SELECT ON user_credits_overview TO service_role;
GRANT SELECT ON user_credits_overview TO postgres;
