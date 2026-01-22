-- ============================================
-- Tesla Studio Monorepo - 数据库 Schema (唯一事实来源)
-- 包含：基础配置、用户体系、积分系统、AI 生成追踪
-- ============================================

-- 0. 基础扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 车型表 (基础车型数据)
CREATE TABLE IF NOT EXISTS models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  model_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 贴图方案表 (统一作品表：包含官方与用户生成)
CREATE TABLE IF NOT EXISTS wraps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- 用户关联 (官方作品为空)
  slug VARCHAR(100) UNIQUE,               -- 官方作品标识 (用户生成作品可为空)
  name VARCHAR(200) NOT NULL,             -- 作品名称
  description TEXT,                       -- 作品描述
  prompt TEXT,                            -- AI 生成提示词
  model_slug TEXT,                        -- 车型标识
  texture_url TEXT NOT NULL,              -- 贴图地址
  preview_url TEXT NOT NULL,              -- 预览图地址
  category VARCHAR(50) DEFAULT 'official',-- 分类: official, community
  download_count INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT TRUE,         -- 是否公开
  deleted_at TIMESTAMP WITH TIME ZONE,    -- 软删除标记
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 车型-贴图关联表
CREATE TABLE IF NOT EXISTS model_wraps (
  model_id UUID REFERENCES models(id) ON DELETE CASCADE,
  wrap_id UUID REFERENCES wraps(id) ON DELETE CASCADE,
  PRIMARY KEY (model_id, wrap_id)
);

-- 4. 用户资料表 (关联 Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 用户积分表 (核心钱包)
CREATE TABLE IF NOT EXISTS user_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER DEFAULT 3 NOT NULL,     -- 初始积分
  total_earned INTEGER DEFAULT 3 NOT NULL,
  total_spent INTEGER DEFAULT 0 NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. AI 生成任务表 (追踪进度与扣费)
DO $$ BEGIN
    CREATE TYPE generation_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS generation_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  status generation_status DEFAULT 'pending',
  credits_spent INTEGER DEFAULT 1,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. 用户生成的贴图记录 (作品集)
CREATE TABLE IF NOT EXISTS generated_wraps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT,
  model_slug TEXT,                        -- 车型标识
  texture_url TEXT NOT NULL,              -- 贴图文件地址
  preview_url TEXT,                       -- 3D 预览图地址
  author_name TEXT,                       -- 作者显示名
  is_public BOOLEAN DEFAULT FALSE,        -- 是否公开到首页
  download_count INTEGER DEFAULT 0,
  deleted_at TIMESTAMP WITH TIME ZONE,     -- 软删除标记
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. 用户下载历史记录
CREATE TABLE IF NOT EXISTS user_downloads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  wrap_id UUID REFERENCES wraps(id) ON DELETE SET NULL,
  downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 索引配置
-- ============================================
CREATE INDEX IF NOT EXISTS idx_wraps_category ON wraps(category);
CREATE INDEX IF NOT EXISTS idx_wraps_is_public ON wraps(is_public);
CREATE INDEX IF NOT EXISTS idx_wraps_user_id ON wraps(user_id);
CREATE INDEX IF NOT EXISTS idx_wraps_model_slug ON wraps(model_slug);
CREATE INDEX IF NOT EXISTS idx_wraps_deleted_at ON wraps(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_generated_wraps_user_id ON generated_wraps(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_wraps_model_slug ON generated_wraps(model_slug);
CREATE INDEX IF NOT EXISTS idx_generated_wraps_is_public ON generated_wraps(is_public);
CREATE INDEX IF NOT EXISTS idx_generated_wraps_deleted_at ON generated_wraps(deleted_at) WHERE deleted_at IS NULL;

-- ============================================
-- 安全触发器 (Triggers)
-- ============================================

-- 新用户注册自动创建 Profile 和积分
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- 创建资料
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'User'));
  
  -- 赋予 3 初始积分 (根据业务需求调整)
  INSERT INTO public.user_credits (user_id, balance, total_earned)
  VALUES (new.id, 3, 3);
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================
-- 安全函数 (RPC)
-- ============================================

-- 1. 增加下载计数
CREATE OR REPLACE FUNCTION increment_download_count(p_wrap_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE wraps SET download_count = download_count + 1 WHERE id = p_wrap_id;
END;
$$ LANGUAGE plpgsql;

-- 2. 原子扣费生成函数 (核心安全逻辑)
-- 保证扣费成功才创建任务，且操作原子化
CREATE OR REPLACE FUNCTION deduct_credits_for_generation(
  p_prompt TEXT,
  p_amount INTEGER DEFAULT 1
)
RETURNS TABLE (
  task_id UUID,
  success BOOLEAN,
  remaining_balance INTEGER,
  error_msg TEXT
) AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_task_id UUID;
BEGIN
  -- 获取并锁定余额行
  SELECT balance INTO v_current_balance
  FROM user_credits
  WHERE user_id = auth.uid()
  FOR UPDATE;

  IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, v_current_balance, 'Insufficient credits'::TEXT;
    RETURN;
  END IF;

  -- 扣费
  UPDATE user_credits
  SET 
    balance = balance - p_amount,
    total_spent = total_spent + p_amount,
    updated_at = NOW()
  WHERE user_id = auth.uid();

  -- 创建任务记录
  INSERT INTO generation_tasks (user_id, prompt, credits_spent, status)
  VALUES (auth.uid(), p_prompt, p_amount, 'pending')
  RETURNING id INTO v_new_task_id;

  RETURN QUERY SELECT v_new_task_id, TRUE, (v_current_balance - p_amount), NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT NULL::UUID, FALSE, v_current_balance, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Row Level Security (RLS) 策略
-- ============================================

-- 基础表
ALTER TABLE models ENABLE ROW LEVEL SECURITY;
ALTER TABLE wraps ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_wraps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read" ON models FOR SELECT USING (true);
CREATE POLICY "Public Read" ON wraps FOR SELECT USING (
  (is_public = true AND (deleted_at IS NULL OR category = 'official')) 
  OR auth.uid() = user_id
);
CREATE POLICY "Insert Own" ON wraps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update Own" ON wraps FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Delete Own" ON wraps FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Public Read" ON model_wraps FOR SELECT USING (true);

-- 用户数据
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own Profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Own Update" ON profiles FOR UPDATE USING (auth.uid() = id);

ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own Credits" ON user_credits FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE user_downloads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own Downloads" ON user_downloads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Insert Downloads" ON user_downloads FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 生成追踪
ALTER TABLE generation_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own Tasks" ON generation_tasks FOR SELECT USING (auth.uid() = user_id);

-- 作品历史记录 (关键：包含软删除和公开查看逻辑)
ALTER TABLE generated_wraps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View Own" ON generated_wraps FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);
CREATE POLICY "Insert Own" ON generated_wraps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update Own" ON generated_wraps FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "View Public" ON generated_wraps FOR SELECT USING (is_public = true AND deleted_at IS NULL);

-- ============================================
-- 初始数据索引加载
-- ============================================
INSERT INTO models (slug, name, model_url) VALUES
  ('cybertruck', 'Cybertruck', 'https://cdn.tewan.club/models/Cybertruck/cybertruck.glb'),
  ('model-3', 'Model 3', 'https://cdn.tewan.club/models/Model-3/model.glb'),
  ('model-3-2024-plus', 'Model 3 2024+', 'https://cdn.tewan.club/models/Model-3-2024-Plus/model.glb'),
  ('model-y-pre-2025', 'Model Y', 'https://cdn.tewan.club/models/Model-Y-Pre-2025/model.glb'),
  ('model-y-2025-plus', 'Model Y 2025+', 'https://cdn.tewan.club/models/Model-Y-2025-Plus/model.glb')
ON CONFLICT (slug) DO NOTHING;
