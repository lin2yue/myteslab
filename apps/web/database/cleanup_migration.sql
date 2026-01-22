-- ============================================
-- 数据库清理与架构同步迁移脚本
-- ============================================

-- 1. 数据迁移：将 generated_wraps 中可能遗留的数据迁移到 wraps (如果 wraps 中还不存在)
-- 注意：根据之前的分析，大部分数据应该已经迁移或正在使用 wraps。
-- 这里做一个安全的合并，避免丢失用户数据。

INSERT INTO wraps (
    user_id, 
    prompt, 
    model_slug, 
    texture_url, 
    preview_url, 
    is_public, 
    download_count, 
    deleted_at, 
    created_at,
    category
)
SELECT 
    g.user_id, 
    g.prompt, 
    g.model_slug, 
    g.texture_url, 
    g.preview_url, 
    g.is_public, 
    g.download_count, 
    g.deleted_at, 
    g.created_at,
    'community'
FROM generated_wraps g
WHERE NOT EXISTS (
    SELECT 1 FROM wraps w WHERE w.texture_url = g.texture_url
);

-- 2. 清理冗余表
DROP TABLE IF EXISTS generated_wraps CASCADE;

-- 3. 清理 profiles 中的旧字段 (如果存在)
ALTER TABLE IF EXISTS profiles DROP COLUMN IF EXISTS credits;

-- 4. 确保 wraps 表字段完整 (防止之前的脚本运行不全)
ALTER TABLE wraps ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE wraps ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE wraps ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 5. 更新模型表 (如果还是用的旧名字 models，则重命名)
-- 注意：在生产环境重命名表需要谨慎，需要配合代码发布。
-- 如果你已经在用 wrap_models，这一步会提示不存在，可以忽略。
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'models') THEN
        ALTER TABLE models RENAME TO wrap_models;
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'model_wraps') THEN
        ALTER TABLE model_wraps RENAME TO wrap_model_map;
    END IF;
END $$;

-- 6. 创建缺失的素材管理表
CREATE TABLE IF NOT EXISTS banners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT,
  image_url TEXT NOT NULL,
  link_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. 重新启用 RLS (针对新表)
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE audios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read" ON banners;
CREATE POLICY "Public Read" ON banners FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Public Read" ON audios;
CREATE POLICY "Public Read" ON audios FOR SELECT USING (true);
