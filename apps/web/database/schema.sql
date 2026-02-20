-- ============================================
-- Tesla Studio Monorepo - 数据库 Schema (唯一事实来源)
-- 包含：基础配置、用户体系、积分系统、AI 生成追踪、素材管理
-- ============================================

-- 0. 基础扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 车型表 (基础车型数据)
CREATE TABLE IF NOT EXISTS wrap_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  name_en VARCHAR(100),
  manufacturer VARCHAR(50) DEFAULT 'Tesla', -- [NEW]
  model_3d_url TEXT NOT NULL,
  thumb_url TEXT,                         -- [NEW] 缩略图
  uv_note TEXT,                           -- [NEW] UV 展开说明
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  wheel_url TEXT,                         -- [NEW] 模块化轮毂模型地址
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() -- [NEW]
);

-- 2. 用户资料表 (关联 Supabase Auth)
-- [CRITICAL] 必须在 wraps 表之前创建，因为 wraps 引用了 profiles
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  role VARCHAR(20) DEFAULT 'user',         -- [NEW] 用户角色 (user, admin, super_admin)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 贴图方案表 (统一作品表：包含官方与用户生成)
CREATE TABLE IF NOT EXISTS wraps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- 权威作者ID
  slug VARCHAR(100) UNIQUE,               -- 官方作品标识
  name VARCHAR(200) NOT NULL,             -- 作品名称
  name_en VARCHAR(200),                   -- 英文名称
  description TEXT,                       -- 作品描述 (Recovered)
  description_en TEXT,                    -- 英文描述
  prompt TEXT,                            -- AI 生成提示词
  model_slug TEXT,                        -- 车型标识
  texture_url TEXT NOT NULL,              -- 贴图地址 (原图)
  preview_url TEXT NOT NULL,              -- 预览图地址
  
  -- 冗余/历史字段 (保留以兼容)
  thumb_url TEXT,                         -- [DEPRECATED] 曾用于缩略图
  thumbnail_url TEXT,                     -- [DEPRECATED] 曾用于缩略图
  author_id UUID,                         -- [DEPRECATED] 旧 User ID
  author_name TEXT,                       -- 快照作者名
  
  category VARCHAR(50),                   -- official, ai_generated, diy
  tags TEXT[],                            -- [NEW] 标签
  source TEXT,                            -- [NEW] 来源
  attribution TEXT,                       -- [NEW] 归属
  
  download_count INTEGER DEFAULT 0,
  user_download_count INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,           -- [NEW]
  is_public BOOLEAN DEFAULT TRUE,         -- 是否公开
  is_active BOOLEAN DEFAULT TRUE,         -- 是否激活
  reference_images TEXT[],                -- AI 参考图列表
  generation_task_id UUID REFERENCES generation_tasks(id), -- [NEW] 关联生成任务
  deleted_at TIMESTAMP WITH TIME ZONE,    -- 软删除标记
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 车型-贴图关联表
CREATE TABLE IF NOT EXISTS wrap_model_map (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- [NEW] 代理主键
  model_id UUID REFERENCES wrap_models(id) ON DELETE CASCADE,
  wrap_id UUID REFERENCES wraps(id) ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT FALSE,       -- [NEW]
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(model_id, wrap_id)               -- [NEW] 唯一约束
);

-- 5. 用户积分表 (核心钱包)
CREATE TABLE IF NOT EXISTS user_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER DEFAULT 30 NOT NULL,     -- 初始积分
  total_earned INTEGER DEFAULT 30 NOT NULL,
  total_spent INTEGER DEFAULT 0 NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. AI 生成任务表 (追踪进度与扣费)
DO $$ BEGIN
    CREATE TYPE generation_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'failed_refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS generation_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  status generation_status DEFAULT 'pending',
  credits_spent INTEGER DEFAULT 10,
  error_message TEXT,
  wrap_id UUID REFERENCES wraps(id) ON DELETE SET NULL,
  idempotency_key UUID UNIQUE,              -- 防止重复提交的唯一键
  steps JSONB DEFAULT '[]'::jsonb,          -- 颗粒度详细步骤追踪
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6.1 积分变动账本 (金融审计回溯)
CREATE TABLE IF NOT EXISTS credit_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id UUID REFERENCES generation_tasks(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL,
  type VARCHAR(50) NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. 用户下载历史记录
CREATE TABLE IF NOT EXISTS user_downloads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  wrap_id UUID REFERENCES wraps(id) ON DELETE SET NULL,
  downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. 轮播图表
CREATE TABLE IF NOT EXISTS banners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT,
  image_url TEXT NOT NULL,
  target_path TEXT,                       -- [UPDATED] from link_url
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. 音频素材表 (完整定义)
CREATE TABLE IF NOT EXISTS audios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  album TEXT,
  file_url TEXT NOT NULL,
  cover_url TEXT,
  duration NUMERIC,
  tags TEXT[],
  play_count INTEGER DEFAULT 0,
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 索引配置
-- ============================================
CREATE INDEX IF NOT EXISTS idx_wraps_category ON wraps(category);
CREATE INDEX IF NOT EXISTS idx_wraps_is_public ON wraps(is_public);
CREATE INDEX IF NOT EXISTS idx_wraps_user_id ON wraps(user_id);
CREATE INDEX IF NOT EXISTS idx_wraps_model_slug ON wraps(model_slug);
CREATE INDEX IF NOT EXISTS idx_wraps_deleted_at ON wraps(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_wraps_is_public_created_at ON wraps(is_public, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wraps_is_public_download_count ON wraps(is_public, download_count DESC);
CREATE INDEX IF NOT EXISTS idx_wraps_is_public_user_download_count ON wraps(is_public, user_download_count DESC);
CREATE INDEX IF NOT EXISTS idx_wraps_created_at ON wraps(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wraps_is_active ON wraps(is_active);
CREATE INDEX IF NOT EXISTS idx_wraps_name_search ON wraps USING gin (name gin_trgm_ops); -- For fuzzy search if pg_trgm is enabled, otherwise use normal index
CREATE INDEX IF NOT EXISTS idx_wraps_name_plain ON wraps(name);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_id ON credit_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_generation_tasks_idempotency ON generation_tasks(idempotency_key);

-- ============================================
-- 安全触发器 (Triggers)
-- ============================================

-- 新用户注册自动创建 Profile 和积分
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- 创建资料
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  
  -- 赋予 30 初始积分
  INSERT INTO public.user_credits (user_id, balance, total_earned)
  VALUES (new.id, 30, 30);
  
  -- 记录初始积分发放
  INSERT INTO public.credit_ledger (user_id, amount, type, description)
  VALUES (new.id, 30, 'top-up', 'New user registration reward');
  
  -- 记录调试日志
  RAISE NOTICE 'New user created: %', new.id;
  
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
CREATE OR REPLACE FUNCTION increment_download_count(wrap_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE wraps
  SET download_count = COALESCE(download_count, 0) + 1,
      user_download_count = COALESCE(user_download_count, download_count, 0) + 1
  WHERE id = wrap_id;
END;
$$ LANGUAGE plpgsql;

-- 2. 原子扣费生成函数 (增强版)
CREATE OR REPLACE FUNCTION deduct_credits_for_generation(
  p_prompt TEXT,
  p_amount INTEGER DEFAULT 10,
  p_idempotency_key UUID DEFAULT NULL
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
  v_existing_task_id UUID;
BEGIN
  -- 1. 幂等性检查
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_task_id FROM generation_tasks WHERE idempotency_key = p_idempotency_key;
    IF v_existing_task_id IS NOT NULL THEN
      SELECT balance INTO v_current_balance FROM user_credits WHERE user_id = auth.uid();
      RETURN QUERY SELECT v_existing_task_id, TRUE, v_current_balance, 'Idempotent hit'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- 2. 获取并锁定余额行
  SELECT balance INTO v_current_balance
  FROM user_credits
  WHERE user_id = auth.uid()
  FOR UPDATE;

  IF v_current_balance IS NULL OR v_current_balance < p_amount THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, v_current_balance, 'Insufficient credits'::TEXT;
    RETURN;
  END IF;

  -- 3. 创建任务记录
  INSERT INTO generation_tasks (user_id, prompt, credits_spent, status, idempotency_key, steps)
  VALUES (auth.uid(), p_prompt, p_amount, 'pending', p_idempotency_key, jsonb_build_array(jsonb_build_object('step', 'deducted', 'ts', NOW())))
  RETURNING id INTO v_new_task_id;

  -- 4. 扣费
  UPDATE user_credits
  SET 
    balance = balance - p_amount,
    total_spent = total_spent + p_amount,
    updated_at = NOW()
  WHERE user_id = auth.uid();

  -- 5. 记录流水
  INSERT INTO credit_ledger (user_id, task_id, amount, type, description)
  VALUES (auth.uid(), v_new_task_id, -p_amount, 'generation', 'AI Wrap Generation: ' || left(p_prompt, 50));

  RETURN QUERY SELECT v_new_task_id, TRUE, (v_current_balance - p_amount), NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT NULL::UUID, FALSE, v_current_balance, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 自动退款 RPC
CREATE OR REPLACE FUNCTION refund_task_credits(
  p_task_id UUID,
  p_reason TEXT DEFAULT 'System technical failure'
)
RETURNS TABLE (
  success BOOLEAN,
  new_balance INTEGER,
  error_msg TEXT
) AS $$
DECLARE
  v_user_id UUID;
  v_amount INTEGER;
  v_status generation_status;
  v_current_balance INTEGER;
BEGIN
  -- 1. 获取任务信息并锁定
  SELECT user_id, credits_spent, status INTO v_user_id, v_amount, v_status
  FROM generation_tasks
  WHERE id = p_task_id
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::INTEGER, 'Task not found'::TEXT;
    RETURN;
  END IF;

  -- 2. 检查状态，防止重复退款
  IF v_status = 'failed_refunded' THEN
    SELECT balance INTO v_current_balance FROM user_credits WHERE user_id = v_user_id;
    RETURN QUERY SELECT TRUE, v_current_balance, 'Already refunded'::TEXT;
    RETURN;
  END IF;

  -- 3. 更新任务状态
  UPDATE generation_tasks
  SET 
    status = 'failed_refunded',
    error_message = COALESCE(error_message || ' | ' || p_reason, p_reason),
    updated_at = NOW(),
    steps = steps || jsonb_build_object('step', 'refunded', 'reason', p_reason, 'ts', NOW())
  WHERE id = p_task_id;

  -- 4. 返还积分
  UPDATE user_credits
  SET 
    balance = balance + v_amount,
    total_spent = total_spent - v_amount,
    updated_at = NOW()
  WHERE user_id = v_user_id
  RETURNING balance INTO v_current_balance;

  -- 5. 记录退款流水
  INSERT INTO credit_ledger (user_id, task_id, amount, type, description)
  VALUES (v_user_id, p_task_id, v_amount, 'refund', 'Refund for task: ' || p_task_id || '. Reason: ' || p_reason);

  RETURN QUERY SELECT TRUE, v_current_balance, NULL::TEXT;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT FALSE, NULL::INTEGER, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Row Level Security (RLS) 策略
-- ============================================

ALTER TABLE wrap_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE wraps ENABLE ROW LEVEL SECURITY;
ALTER TABLE wrap_model_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE audios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read" ON wrap_models FOR SELECT USING (true);
CREATE POLICY "Public Read" ON banners FOR SELECT USING (is_active = true);
CREATE POLICY "Public Read" ON audios FOR SELECT USING (true);

CREATE POLICY "Public Read Wraps" ON wraps FOR SELECT USING (
  (is_public = true AND (deleted_at IS NULL OR category = 'official')) 
  OR auth.uid() = user_id
);
CREATE POLICY "Insert Own" ON wraps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update Own" ON wraps FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Delete Own" ON wraps FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Public Read" ON wrap_model_map FOR SELECT USING (true);

-- 用户数据
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Own Update" ON profiles FOR UPDATE USING (auth.uid() = id);

ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own Credits" ON user_credits FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE user_downloads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own Downloads" ON user_downloads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Insert Downloads" ON user_downloads FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 生成追踪
ALTER TABLE generation_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own Tasks" ON generation_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Update Own Tasks" ON generation_tasks FOR UPDATE USING (auth.uid() = user_id);

-- 积分流水
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own Ledger" ON credit_ledger FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- 初始数据索引加载
-- ============================================
INSERT INTO wrap_models (slug, name, model_3d_url, sort_order) VALUES
  ('cybertruck', 'Cybertruck', 'https://cdn.tewan.club/models/wraps/cybertruck/model_v1.glb', 1),
  ('model-3', 'Model 3', 'https://cdn.tewan.club/models/wraps/model-3/model_v1.glb', 2),
  ('model-3-2024', 'Model 3 焕新版', 'https://cdn.tewan.club/models/wraps/model-3-2024-plus/model_v2.glb', 3),
  ('model-y-2025-standard', 'Model Y 基础版', 'https://cdn.tewan.club/models/wraps/model-y-2025-plus/model_v5.glb', 4),
  ('model-y', 'Model Y', 'https://cdn.tewan.club/models/wraps/model-y-pre-2025/model_v2.glb', 5)
ON CONFLICT (slug) DO NOTHING;
