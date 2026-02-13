-- ============================================
-- web-cn RDS Business Schema (No Supabase Auth)
-- 依赖：已执行 rds_auth_schema.sql
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. 车型表 (基础车型数据)
CREATE TABLE IF NOT EXISTS wrap_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  name_en VARCHAR(100),
  manufacturer VARCHAR(50) DEFAULT 'Tesla',
  model_3d_url TEXT NOT NULL,
  thumb_url TEXT,
  uv_note TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  wheel_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 贴图方案表
CREATE TABLE IF NOT EXISTS wraps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug VARCHAR(100) UNIQUE,
  name VARCHAR(200) NOT NULL,
  name_en VARCHAR(200),
  description TEXT,
  description_en TEXT,
  prompt TEXT,
  model_slug TEXT,
  texture_url TEXT NOT NULL,
  preview_url TEXT NOT NULL,

  -- 冗余/历史字段
  thumb_url TEXT,
  thumbnail_url TEXT,
  author_id UUID,
  author_name TEXT,

  category VARCHAR(50),
  tags TEXT[],
  source TEXT,
  attribution TEXT,

  download_count INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  reference_images TEXT[],
  generation_task_id UUID, -- FK in later step
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 车型-贴图关联表
CREATE TABLE IF NOT EXISTS wrap_model_map (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_id UUID REFERENCES wrap_models(id) ON DELETE CASCADE,
  wrap_id UUID REFERENCES wraps(id) ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(model_id, wrap_id)
);

-- 4. AI 生成任务表
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
  error_code TEXT,
  wrap_id UUID REFERENCES wraps(id) ON DELETE SET NULL,
  idempotency_key TEXT UNIQUE,
  steps JSONB DEFAULT '[]'::jsonb,
  version INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_owner TEXT,
  lease_expires_at TIMESTAMP WITH TIME ZONE,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT generation_tasks_version_non_negative CHECK (version >= 0),
  CONSTRAINT generation_tasks_attempts_non_negative CHECK (attempts >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- wraps -> generation_tasks 外键 (用于环引用)
ALTER TABLE wraps
  ADD CONSTRAINT wraps_generation_task_fk
  FOREIGN KEY (generation_task_id) REFERENCES generation_tasks(id);

-- 5. 积分变动账本
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

-- 6. 用户下载历史记录
CREATE TABLE IF NOT EXISTS user_downloads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  wrap_id UUID REFERENCES wraps(id) ON DELETE SET NULL,
  downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. 轮播图表
CREATE TABLE IF NOT EXISTS banners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT,
  image_url TEXT NOT NULL,
  target_path TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. 音频素材表
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

CREATE TABLE IF NOT EXISTS user_audio_downloads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  audio_id UUID REFERENCES audios(id) ON DELETE SET NULL,
  downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. 用户偏好设置
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  ai_generator_last_model VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_wraps_category ON wraps(category);
CREATE INDEX IF NOT EXISTS idx_wraps_is_public ON wraps(is_public);
CREATE INDEX IF NOT EXISTS idx_wraps_user_id ON wraps(user_id);
CREATE INDEX IF NOT EXISTS idx_wraps_model_slug ON wraps(model_slug);
CREATE INDEX IF NOT EXISTS idx_wraps_deleted_at ON wraps(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_wraps_is_public_created_at ON wraps(is_public, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wraps_is_public_download_count ON wraps(is_public, download_count DESC);
CREATE INDEX IF NOT EXISTS idx_wraps_created_at ON wraps(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wraps_is_active ON wraps(is_active);
CREATE INDEX IF NOT EXISTS idx_wraps_name_search ON wraps USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_wraps_name_plain ON wraps(name);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_id ON credit_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_task_created_at ON credit_ledger(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_tasks_idempotency ON generation_tasks(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_generation_tasks_user_status_updated_at ON generation_tasks(user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_generation_tasks_status_lease_retry ON generation_tasks(status, lease_expires_at, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_wraps_generation_task_user_id ON wraps(generation_task_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_ledger_task_generation_charge_once
  ON credit_ledger(task_id)
  WHERE task_id IS NOT NULL
    AND type IN ('generation', 'generation_charge');
CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_ledger_task_refund_once
  ON credit_ledger(task_id)
  WHERE task_id IS NOT NULL
    AND type = 'refund';
CREATE INDEX IF NOT EXISTS idx_user_audio_downloads_user_id ON user_audio_downloads(user_id);
