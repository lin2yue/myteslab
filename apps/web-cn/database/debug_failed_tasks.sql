-- 查询最近失败的 AI 生成任务及错误信息
-- 运行此查询以排查生成失败的原因

-- 1. 查看最近 10 条失败的任务
SELECT 
    id,
    user_id,
    prompt,
    status,
    credits_spent,
    error_message,
    created_at,
    updated_at
FROM generation_tasks
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 10;

-- 2. 统计失败任务的错误类型
SELECT 
    error_message,
    COUNT(*) as count,
    MAX(created_at) as last_occurrence
FROM generation_tasks
WHERE status = 'failed'
GROUP BY error_message
ORDER BY count DESC;

-- 3. 查看特定用户最近的任务（替换 YOUR_USER_ID）
-- SELECT 
--     id,
--     prompt,
--     status,
--     credits_spent,
--     error_message,
--     created_at
-- FROM generation_tasks
-- WHERE user_id = 'YOUR_USER_ID'
-- ORDER BY created_at DESC
-- LIMIT 20;
