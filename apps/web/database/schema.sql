-- ============================================
-- Tesla Studio MVP 数据库Schema
-- ============================================

-- 1. 车型表
CREATE TABLE IF NOT EXISTS models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  model_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. 贴图表
CREATE TABLE IF NOT EXISTS wraps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  texture_url TEXT NOT NULL,
  preview_url TEXT NOT NULL,
  category VARCHAR(50) DEFAULT 'official',
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. 车型-贴图关联表
CREATE TABLE IF NOT EXISTS model_wraps (
  model_id UUID REFERENCES models(id) ON DELETE CASCADE,
  wrap_id UUID REFERENCES wraps(id) ON DELETE CASCADE,
  PRIMARY KEY (model_id, wrap_id)
);

-- 创建索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_wraps_category ON wraps(category);
CREATE INDEX IF NOT EXISTS idx_wraps_created_at ON wraps(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_wraps_model_id ON model_wraps(model_id);
CREATE INDEX IF NOT EXISTS idx_model_wraps_wrap_id ON model_wraps(wrap_id);

-- ============================================
-- 初始数据
-- ============================================

-- 插入车型数据
INSERT INTO models (slug, name, model_url) VALUES
  ('cybertruck', 'Cybertruck', 'https://cdn.tewan.club/models/Cybertruck/cybertruck.glb'),
  ('model-3', 'Model 3', 'https://cdn.tewan.club/models/Model-3/model.glb'),
  ('model-3-2024-plus', 'Model 3 2024+', 'https://cdn.tewan.club/models/Model-3-2024-Plus/model.glb'),
  ('model-y-pre-2025', 'Model Y', 'https://cdn.tewan.club/models/Model-Y-Pre-2025/model.glb'),
  ('model-y-2025-plus', 'Model Y 2025+', 'https://cdn.tewan.club/models/Model-Y-2025-Plus/model.glb')
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- 辅助函数
-- ============================================

-- 增加下载计数的函数
CREATE OR REPLACE FUNCTION increment_download_count(wrap_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE wraps 
  SET download_count = download_count + 1 
  WHERE id = wrap_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Row Level Security (RLS) 策略
-- ============================================

-- 启用RLS
ALTER TABLE models ENABLE ROW LEVEL SECURITY;
ALTER TABLE wraps ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_wraps ENABLE ROW LEVEL SECURITY;

-- 允许所有人读取(MVP阶段无需登录)
CREATE POLICY "Allow public read access on models"
  ON models FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access on wraps"
  ON wraps FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access on model_wraps"
  ON model_wraps FOR SELECT
  USING (true);

-- ============================================
-- 用户体系 (User System)
-- ============================================

-- 4. 用户资料表 (Profiles) - 关联 supabase auth.users
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. 用户积分表 (User Credits)
CREATE TABLE IF NOT EXISTS user_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER DEFAULT 0,
  total_earned INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. 用户生成的贴图 (Generated Wraps)
CREATE TABLE IF NOT EXISTS generated_wraps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT,
  style_prescription TEXT,
  texture_url TEXT NOT NULL,
  preview_url TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 7. 用户下载记录 (User Downloads)
CREATE TABLE IF NOT EXISTS user_downloads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  wrap_id UUID REFERENCES wraps(id) ON DELETE SET NULL,
  downloaded_at TIMESTAMP DEFAULT NOW()
);

-- Trigger to create profile and credits on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (new.id, 10); -- Give 10 free credits
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger execution
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- New RLS Policies

-- Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- User Credits
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own credits" ON user_credits FOR SELECT USING (auth.uid() = user_id);

-- Generated Wraps
ALTER TABLE generated_wraps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own generated wraps" ON generated_wraps FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create generated wraps" ON generated_wraps FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Allow public to view if marked public (future feature)
CREATE POLICY "Public can view public generated wraps" ON generated_wraps FOR SELECT USING (is_public = true);

-- User Downloads
ALTER TABLE user_downloads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own downloads" ON user_downloads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert downloads" ON user_downloads FOR INSERT WITH CHECK (auth.uid() = user_id);
