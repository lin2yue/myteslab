-- 更新 handle_new_user 触发器，确保新用户获得 30 积分
-- 原因：旧逻辑可能仍然使用 15 积分或默认值，必须强制更新为 30

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- 创建资料
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  
  -- 赋予 30 初始积分 (明确指定)
  INSERT INTO public.user_credits (user_id, balance, total_earned)
  VALUES (new.id, 30, 30);
  
  -- 记录初始积分发放
  INSERT INTO public.credit_ledger (user_id, amount, type, description)
  VALUES (new.id, 30, 'top-up', 'New user registration reward');
  
  -- 记录调试日志
  RAISE NOTICE 'New user created: % with 30 credits', new.id;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 更新积分表的默认值，作为双重保障
ALTER TABLE user_credits ALTER COLUMN balance SET DEFAULT 30;
ALTER TABLE user_credits ALTER COLUMN total_earned SET DEFAULT 30;
