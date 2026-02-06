#!/bin/bash

# 查询失败的任务并退款
# 使用方法: ./refund-failed-tasks.sh [user_email]

USER_EMAIL="${1:-lin2yue@gmail.com}"

echo "🔍 查询失败的任务..."
echo "用户: $USER_EMAIL"
echo ""

# 连接数据库并查询失败任务
psql "$DATABASE_URL" << EOF
-- 查询失败的任务
SELECT 
  gt.id as task_id,
  gt.user_id,
  u.email,
  gt.prompt,
  gt.status,
  gt.credits_spent,
  gt.error_message,
  gt.created_at
FROM generation_tasks gt
LEFT JOIN users u ON gt.user_id = u.id
WHERE u.email = '$USER_EMAIL'
  AND gt.status IN ('failed', 'processing')
  AND gt.created_at > NOW() - INTERVAL '1 day'
ORDER BY gt.created_at DESC;

\echo ''
\echo '💰 执行退款...'
\echo ''

-- 开始事务并执行退款
BEGIN;

-- 对每个失败的任务执行退款
WITH failed_tasks AS (
  SELECT 
    gt.id,
    gt.user_id,
    gt.credits_spent,
    gt.error_message
  FROM generation_tasks gt
  LEFT JOIN users u ON gt.user_id = u.id
  WHERE u.email = '$USER_EMAIL'
    AND gt.status IN ('failed', 'processing')
    AND gt.created_at > NOW() - INTERVAL '1 day'
),
refund_credits AS (
  UPDATE user_credits uc
  SET 
    balance = balance + (
      SELECT COALESCE(SUM(credits_spent), 0) 
      FROM failed_tasks ft 
      WHERE ft.user_id = uc.user_id
    ),
    total_spent = GREATEST(
      total_spent - (
        SELECT COALESCE(SUM(credits_spent), 0) 
        FROM failed_tasks ft 
        WHERE ft.user_id = uc.user_id
      ), 
      0
    ),
    updated_at = NOW()
  FROM failed_tasks ft
  WHERE uc.user_id = ft.user_id
  RETURNING uc.user_id, uc.balance
),
insert_ledger AS (
  INSERT INTO credit_ledger (user_id, task_id, amount, type, description, created_at)
  SELECT 
    ft.user_id,
    ft.id,
    ft.credits_spent,
    'refund',
    'Admin refund: ' || COALESCE(ft.error_message, 'Database error'),
    NOW()
  FROM failed_tasks ft
  RETURNING task_id, amount
),
update_tasks AS (
  UPDATE generation_tasks gt
  SET 
    status = 'failed_refunded',
    error_message = COALESCE(error_message, 'Refunded by admin'),
    updated_at = NOW()
  FROM failed_tasks ft
  WHERE gt.id = ft.id
  RETURNING gt.id, gt.user_id
)
SELECT 
  COUNT(*) as refunded_count,
  SUM(il.amount) as total_refunded
FROM insert_ledger il;

COMMIT;

\echo ''
\echo '✅ 退款完成!'
\echo ''

-- 显示用户当前余额
SELECT 
  u.email,
  uc.balance as current_balance,
  uc.total_earned,
  uc.total_spent
FROM users u
LEFT JOIN user_credits uc ON u.id = uc.user_id
WHERE u.email = '$USER_EMAIL';

EOF
