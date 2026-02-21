-- 更新 handle_new_user 触发器，确保新用户获得 30 积分
-- 原因：旧逻辑可能仍然使用 15 积分或默认值，必须强制更新为 30

CREATE TABLE IF NOT EXISTS credit_reward_rules (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  registration_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  registration_credits INTEGER NOT NULL DEFAULT 30 CHECK (registration_credits >= 0),
  download_reward_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  download_threshold INTEGER NOT NULL DEFAULT 100 CHECK (download_threshold >= 1),
  download_reward_credits INTEGER NOT NULL DEFAULT 10 CHECK (download_reward_credits >= 0),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO credit_reward_rules (
  id,
  registration_enabled,
  registration_credits,
  download_reward_enabled,
  download_threshold,
  download_reward_credits
)
VALUES (1, TRUE, 30, FALSE, 100, 10)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_registration_enabled BOOLEAN := TRUE;
  v_registration_credits INTEGER := 30;
  v_reward INTEGER := 30;
BEGIN
  -- 创建资料
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));

  SELECT registration_enabled, registration_credits
    INTO v_registration_enabled, v_registration_credits
  FROM public.credit_reward_rules
  WHERE id = 1;

  v_reward := CASE WHEN COALESCE(v_registration_enabled, TRUE) THEN GREATEST(COALESCE(v_registration_credits, 30), 0) ELSE 0 END;
  
  -- 赋予可配置初始积分
  INSERT INTO public.user_credits (user_id, balance, total_earned)
  VALUES (new.id, v_reward, v_reward);
  
  -- 记录初始积分发放
  IF v_reward > 0 THEN
    INSERT INTO public.credit_ledger (user_id, amount, type, description, metadata)
    VALUES (new.id, v_reward, 'system_reward', 'New user registration reward', jsonb_build_object('source', 'new_user_signup'));
  END IF;
  
  -- 记录调试日志
  RAISE NOTICE 'New user created: % with 30 credits', new.id;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 更新积分表的默认值，作为双重保障
ALTER TABLE user_credits ALTER COLUMN balance SET DEFAULT 30;
ALTER TABLE user_credits ALTER COLUMN total_earned SET DEFAULT 30;
