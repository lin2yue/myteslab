-- ============================================
-- Fix Schema Drift Migration Script
-- 修复线上数据库与 schema.sql 定义不一致的问题
-- ============================================

-- 1. Wraps 表修复
-- 添加 description 字段 (如果缺失)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wraps' AND column_name = 'description') THEN
        ALTER TABLE wraps ADD COLUMN description TEXT;
    END IF;
END $$;

-- 迁移 author_id -> user_id (数据修复)
-- 将 author_id 的值赋给 user_id (如果 user_id 为空)
UPDATE wraps 
SET user_id = author_id::uuid 
WHERE user_id IS NULL AND author_id IS NOT NULL;

-- 2. Banners 表修复
-- 确保 target_path 存在 (实际已存在，这里只是为了脚本完整性，或添加注释)
-- 注意：schema.sql 之前叫 link_url，现在统一改为 target_path
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'banners' AND column_name = 'target_path') THEN
        ALTER TABLE banners ADD COLUMN target_path TEXT;
    END IF;
    -- 如果 link_url 存在且有值，迁移到 target_path
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'banners' AND column_name = 'link_url') THEN
        UPDATE banners SET target_path = link_url WHERE target_path IS NULL AND link_url IS NOT NULL;
    END IF;
END $$;

-- 3. Wrap Models 表修复
-- 补充缺失的字段定义
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wrap_models' AND column_name = 'updated_at') THEN
        ALTER TABLE wrap_models ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wrap_models' AND column_name = 'thumb_url') THEN
        ALTER TABLE wrap_models ADD COLUMN thumb_url TEXT;
    END IF;
     IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wrap_models' AND column_name = 'manufacturer') THEN
        ALTER TABLE wrap_models ADD COLUMN manufacturer TEXT DEFAULT 'Tesla';
    END IF;
END $$;

-- 4. 确保 wraps 只有 user_id 是权威的关联字段
-- 以后不再使用 author_id (保留字段但标记为废弃)

-- 5. 添加 updated_at 触发器 (如果缺失)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_wrap_models_updated_at') THEN
        CREATE TRIGGER update_wrap_models_updated_at
        BEFORE UPDATE ON wrap_models
        FOR EACH ROW
        EXECUTE PROCEDURE update_updated_at_column();
    END IF;
END $$;

-- 6. 优化 profiles 表查询性能 (Login checkUserExists)
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
