-- Creator Marketplace MVP Migration
-- Created: 2026-02-24

-- 1. user_credits 增加双积分字段
ALTER TABLE user_credits
  ADD COLUMN IF NOT EXISTS paid_balance INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gift_balance INTEGER NOT NULL DEFAULT 0;

-- 2. 数据迁移：将现有积分拆分为 gift/paid
-- 有充值记录的用户：当前余额全算 paid_balance
-- 无充值记录的用户：当前余额全算 gift_balance
UPDATE user_credits uc
SET
  paid_balance = CASE WHEN topup.total > 0 THEN uc.balance ELSE 0 END,
  gift_balance = CASE WHEN topup.total > 0 THEN 0 ELSE uc.balance END
FROM (
  SELECT user_id, COALESCE(SUM(amount), 0) as total
  FROM credit_ledger WHERE type = 'top-up'
  GROUP BY user_id
) topup
WHERE uc.user_id = topup.user_id;

-- 处理没有充值记录的用户
UPDATE user_credits
SET paid_balance = 0, gift_balance = balance
WHERE paid_balance = 0 AND gift_balance = 0;

-- 3. profiles 增加创作者简介
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS creator_bio TEXT;

-- 4. wraps 增加商城字段
ALTER TABLE wraps
  ADD COLUMN IF NOT EXISTS price_credits INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS marketplace_status VARCHAR(20) DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS creator_earnings INTEGER NOT NULL DEFAULT 0;

-- 5. wrap 购买记录表
CREATE TABLE IF NOT EXISTS wrap_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  wrap_id UUID NOT NULL REFERENCES wraps(id) ON DELETE CASCADE,
  credits_paid INTEGER NOT NULL,
  creator_credits_earned INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(buyer_id, wrap_id)
);

ALTER TABLE wrap_purchases ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Own Purchases" ON wrap_purchases FOR SELECT USING (auth.uid() = buyer_id);
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  CREATE POLICY "Insert Purchase" ON wrap_purchases FOR INSERT WITH CHECK (auth.uid() = buyer_id);
EXCEPTION WHEN duplicate_object THEN null;
END $$;
