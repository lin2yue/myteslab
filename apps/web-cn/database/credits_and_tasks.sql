-- ============================================
-- AI Wrap 生成功能 - 积分与任务日志系统
-- ============================================

-- 1. 用户档案表 (用于存储积分)
-- 该表扩展了 Supabase auth.users 表
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits INTEGER DEFAULT 5 NOT NULL, -- 默认赠送 5 次生成机会
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. AI 生成任务日志表
-- 记录每一次生成的详细信息
CREATE TABLE IF NOT EXISTS wrap_generation_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  model_slug VARCHAR(50) NOT NULL,
  prompt TEXT NOT NULL,
  reference_images TEXT[],
  status VARCHAR(20) DEFAULT 'pending',  -- pending, processing, completed, failed
  result_texture_url TEXT,               -- 成功生成的图片URL (Base64生成也建议转存OSS)
  is_public BOOLEAN DEFAULT false,       -- 用户是否公开
  error_message TEXT,                    -- 失败原因
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- ============================================
-- Row Level Security (RLS) 策略
-- ============================================

-- 启用 RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wrap_generation_tasks ENABLE ROW LEVEL SECURITY;

-- Profiles 策略
-- 用户只能查看自己的积分
CREATE POLICY "Users can view own profile" 
  ON profiles FOR SELECT 
  USING (auth.uid() = id);

-- 仅允许服务器端(Service Role)修改积分，或者特定的触发器
-- 或者通过安全定义的函数修改
CREATE POLICY "Users can view own profile" 
  ON profiles FOR SELECT 
  USING (auth.uid() = id);

-- ============================================
-- 安全函数 (RPC)
-- ============================================

-- 扣除积分函数
-- SECURITY DEFINER: 也就是以函数创建者(admin)的权限运行，绕过RLS
CREATE OR REPLACE FUNCTION decrement_credits()
RETURNS void AS $$
DECLARE
  current_credits INTEGER;
BEGIN
  -- 获取当前积分并锁定行
  SELECT credits INTO current_credits FROM profiles WHERE id = auth.uid() FOR UPDATE;
  
  IF current_credits IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF current_credits <= 0 THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  -- 扣除积分
  UPDATE profiles SET credits = credits - 1 WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 
  ON wrap_generation_tasks FOR SELECT 
  USING (auth.uid() = user_id);

-- 用户可以创建任务 (API 调用时)
CREATE POLICY "Users can insert own tasks" 
  ON wrap_generation_tasks FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 自动化触发器 (可选)
-- ============================================

-- 当新用户注册时自动创建 profile
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, credits)
  VALUES (new.id, 5);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 绑定到 auth.users 的触发器
-- 注意：这需要 supabase_admin 权限才能执行，可以在 Supabase Dashboard SQL Editor 中运行
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
