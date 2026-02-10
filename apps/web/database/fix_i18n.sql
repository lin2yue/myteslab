
-- 1. 为现有的 wrap_models 增加英文名称 (如果缺失)
UPDATE wrap_models SET name_en = 'Cybertruck' WHERE slug = 'cybertruck' AND name_en IS NULL;
UPDATE wrap_models SET name_en = 'Model 3' WHERE slug = 'model-3' AND name_en IS NULL;
UPDATE wrap_models SET name_en = 'Model 3 2024+' WHERE slug = 'model-3-2024' AND name_en IS NULL;
UPDATE wrap_models SET name_en = 'Model Y' WHERE slug = 'model-y' AND name_en IS NULL;
UPDATE wrap_models SET name_en = 'Model Y 2025+' WHERE slug = 'model-y-2025-standard' AND name_en IS NULL;

-- 2. 为现有的 wraps 完善 name_en (简单 backfill：直接复制 name 或 prompt)
UPDATE wraps SET name_en = name WHERE name_en IS NULL;
UPDATE wraps SET description_en = description WHERE description_en IS NULL;

-- 3. 将来可以手动或通过脚本优化已有的英文标题
