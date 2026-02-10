-- Seed data for wraps table
BEGIN;

            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('023d4b53-01b1-4d21-a4d9-6daa312b81ce', '气球主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-d729a47f-1769326652824.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'https://cdn.tewan.club/wraps/ai-generated/wrap-d729a47f-1769326652824.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'model-y-2025-standard', false, '气球主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('0256d974-1df6-4400-b838-9ee352b64132', 'Ani', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Ani.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-ani.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('029cae81-3331-46a2-a542-a70d1ef62558', '变异鲨鱼', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-5b633b08-1769047031325.png', 'https://cdn.tewan.club/wraps/previews/preview-029cae81-1769189783516.png', 'model-y', true, '变异鲨鱼', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('03d3668a-ccc2-451a-9f0a-c615984c353e', 'Camo', 'official', 'https://cdn.tewan.club/catalog/model-3/wraps/Official/Camo.png', 'https://cdn.tewan.club/previews/model-3/model-3-official-camo.png', 'model-3', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('057827c1-3d08-4f60-b0b2-16510fbf95e5', 'Sketch', 'official', 'https://cdn.tewan.club/catalog/model-y-pre-2025/wraps/Official/Sketch.png', 'https://cdn.tewan.club/previews/model-y-pre-2025/model-y-pre-2025-official-sketch.png', 'model-y', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('0c07274c-6d39-49c3-aa91-4c61d88b8c38', '黄色背景，香蕉主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/migrated-0c07274c-1769191171411.png', 'https://cdn.tewan.club/wraps/previews/preview-0c07274c-1769191298425.png', 'cybertruck', false, '黄色背景，香蕉主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('0c711e74-01c9-486d-bcf0-db3d21ff53fb', 'Valentine', 'official', 'https://cdn.tewan.club/catalog/model-3/wraps/Official/Valentine.png', 'https://cdn.tewan.club/previews/model-3/model-3-official-valentine.png', 'model-3', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('0c98de5c-2410-4527-bf80-150d922d99f6', '小黄鸭主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-3cff6111-1769197385373.png', 'https://cdn.tewan.club/wraps/previews/preview-0c98de5c-1769234885531.png', 'model-3-2024', true, '小黄鸭主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('0ca643fc-14f3-4f7b-85df-04d533ed4412', 'Rudi', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Rudi.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-rudi.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('10dabc5c-05ae-4dcb-bdaa-ca160d15d361', 'Reindeer', 'official', 'https://cdn.tewan.club/catalog/model-3/wraps/Official/Reindeer.png', 'https://cdn.tewan.club/previews/model-3/model-3-official-reindeer.png', 'model-3', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('1157cd1e-b81e-46a8-bb1f-7159ca9315b2', 'Camo', 'official', 'https://cdn.tewan.club/catalog/model-y-pre-2025/wraps/Official/Camo.png', 'https://cdn.tewan.club/previews/model-y-pre-2025/model-y-pre-2025-official-camo.png', 'model-y', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('12993606-6304-461b-bd0b-9d4338f21b0e', '疯狂动物城，朱迪警官主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/migrated-12993606-1769191173101.png', 'https://cdn.tewan.club/wraps/previews/preview-12993606-1769191283636.png', 'cybertruck', false, '疯狂动物城，朱迪警官主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('1326417f-bb32-4ff7-a10d-deebb8dae81e', 'super junior 20周年主题，要有9成员的人物形象', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-b6e2aeaf-1769011842604.png', 'https://cdn.tewan.club/wraps/previews/preview-1326417f-1769189787613.png', 'model-y', true, 'super junior 20周年主题，要有9成员的人物形象', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('14116eb5-ce67-4b81-aee0-f1874ffce362', '黄色背景，香蕉叶主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/migrated-14116eb5-1769191171810.png', 'https://cdn.tewan.club/wraps/previews/preview-14116eb5-1769191294683.png', 'cybertruck', true, '黄色背景，香蕉叶主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('14bb3a29-8f74-4223-a4e6-af6985f60133', 'Divide', 'official', 'https://cdn.tewan.club/catalog/model-y-pre-2025/wraps/Official/Divide.png', 'https://cdn.tewan.club/previews/model-y-pre-2025/model-y-pre-2025-official-divide.png', 'model-y', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('1889d3b4-3ded-49e4-94fe-17b3988a287b', '白色背景，美少女战士主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/migrated-1889d3b4-1769191170070.png', 'https://cdn.tewan.club/wraps/previews/preview-1889d3b4-1769191309517.png', 'cybertruck', false, '白色背景，美少女战士主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('1a0b6dcf-ce14-46f1-95eb-fdf7b6c57f15', 'Camo', 'official', 'https://cdn.tewan.club/catalog/model-y-2025-plus/wraps/Official/Camo.png', 'https://cdn.tewan.club/previews/model-y-2025-plus/model-y-2025-plus-official-camo.png', 'model-y-2025-standard', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('1a1d244c-a0be-48bd-915f-5c1fd9f4b2a5', 'Rust', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Rust.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-rust.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('1ab92f3f-6c73-4e55-ac78-4381fff7c152', 'Cosmic Burst', 'official', 'https://cdn.tewan.club/catalog/model-y-pre-2025/wraps/Official/Cosmic_Burst.png', 'https://cdn.tewan.club/previews/model-y-pre-2025/model-y-pre-2025-official-cosmic-burst.png', 'model-y', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('1ae967c0-02ad-4382-820f-362ba3a8cfc9', 'Pixel Art', 'official', 'https://cdn.tewan.club/catalog/model-3-2024-plus/wraps/Official/Pixel_Art.png', 'https://cdn.tewan.club/previews/model-3-2024-plus/model-3-2024-plus-official-pixel-art.png', 'model-3-2024', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('1d525b62-a437-45d0-b240-bef31f64b04d', 'Sakura', 'official', 'https://cdn.tewan.club/catalog/model-3/wraps/Official/Sakura.png', 'https://cdn.tewan.club/previews/model-3/model-3-official-sakura.png', 'model-3', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('1eaf81f8-f69a-4a74-b3fc-034cd9d8e9b9', 'F1 梅赛德斯车队赛车涂装', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-d607695a-1769240543506.png', 'https://cdn.tewan.club/wraps/previews/preview-1eaf81f8-1769257678488.png', 'model-3-2024', true, 'F1 梅赛德斯车队赛车涂装', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('1f31e683-aff9-4af6-bae3-2c214891e00d', '美国出租车', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-3c4ff1c2-1769323768295.png', 'https://cdn.tewan.club/wraps/ai-generated/wrap-3c4ff1c2-1769323768295.png', 'cybertruck', false, '美国出租车', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('1f46f18f-4595-4a17-b20a-35b6de6f745c', '极光米黄', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-1507b84e-1769674572247.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'https://cdn.tewan.club/wraps/previews/preview-1f46f18f-1769674640306.png', 'model-3-2024', true, '小米ultra黄色车身拉花', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('20249476-fcb5-43bf-b7ef-db9d01ae2c39', 'Cosmic Burst', 'official', 'https://cdn.tewan.club/catalog/model-3-2024-plus/wraps/Official/Cosmic_Burst.png', 'https://cdn.tewan.club/previews/model-3-2024-plus/model-3-2024-plus-official-cosmic-burst.png', 'model-3-2024', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('21afed72-9e65-42f4-a662-34dd9eb484c1', 'Valentine', 'official', 'https://cdn.tewan.club/catalog/model-y-pre-2025/wraps/Official/Valentine.png', 'https://cdn.tewan.club/previews/model-y-pre-2025/model-y-pre-2025-official-valentine.png', 'model-y', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('22886492-725d-4338-9a57-1bbb21623e27', 'Sketch', 'official', 'https://cdn.tewan.club/catalog/model-3/wraps/Official/Sketch.png', 'https://cdn.tewan.club/previews/model-3/model-3-official-sketch.png', 'model-3', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('230e0f05-b79d-4d6c-9d27-9b7d91aa7978', 'Sketch', 'official', 'https://cdn.tewan.club/catalog/model-3-2024-plus/wraps/Official/Sketch.png', 'https://cdn.tewan.club/previews/model-3-2024-plus/model-3-2024-plus-official-sketch.png', 'model-3-2024', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('247d12f7-384f-42dc-9446-ca963ea00b52', '火焰主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-5509dcb0-1769331124322.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'https://cdn.tewan.club/wraps/ai-generated/wrap-5509dcb0-1769331124322.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'model-y-2025-standard', false, '火焰主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('25e98224-ceac-4351-ade2-a605044acb81', 'Rudi', 'official', 'https://cdn.tewan.club/catalog/model-3/wraps/Official/Rudi.png', 'https://cdn.tewan.club/previews/model-3/model-3-official-rudi.png', 'model-3', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('2617f7da-d2d1-44d4-93f3-6c19c9ed345b', '草莓主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-e62f784f-1769324336106.png', 'https://cdn.tewan.club/wraps/ai-generated/wrap-e62f784f-1769324336106.png', 'model-y-2025-standard', false, '草莓主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('28da2ef2-4a3d-44c4-a16c-d57c22b060fb', 'Houndstooth', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Houndstooth.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-houndstooth.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('293b4227-e4d8-4970-9c2e-0b61a2918db0', '美国消防车', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-e784767b-1769240236509.png', 'https://cdn.tewan.club/wraps/ai-generated/wrap-e784767b-1769240236509.png', 'cybertruck', false, '美国消防车', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('29d2f0f9-d198-48b5-8c70-99c0eacd2e3f', 'Ice Cream', 'official', 'https://cdn.tewan.club/catalog/model-3/wraps/Official/Ice_Cream.png', 'https://cdn.tewan.club/previews/model-3/model-3-official-ice-cream.png', 'model-3', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('2b132f04-a2c6-45a7-8de3-79ab43cbc162', '宝蓝信仰', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-9f17ba8c-1769484441030.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'https://cdn.tewan.club/wraps/previews/preview-2b132f04-1769484494311.png', 'model-y', true, '生成一个 Super Junior 主题，蓝色主色调，人物呈现要准确', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('2ba3564b-d430-4256-b621-28ceea2aa1d7', 'Avocado Green', 'official', 'https://cdn.tewan.club/catalog/model-3-2024-plus/wraps/Official/Avocado_Green.png', 'https://cdn.tewan.club/previews/model-3-2024-plus/model-3-2024-plus-official-avocado-green.png', 'model-3-2024', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('2baea4e4-07a5-4c3b-9aa2-271cf2bfc040', 'Rudi', 'official', 'https://cdn.tewan.club/catalog/model-y-2025-plus/wraps/Official/Rudi.png', 'https://cdn.tewan.club/previews/model-y-2025-plus/model-y-2025-plus-official-rudi.png', 'model-y-2025-standard', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('2bb7b8ed-5ab8-4f09-8c38-c7b5c5c166e1', '红色背景，七龙珠', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/migrated-2bb7b8ed-1769191172212.png', 'https://cdn.tewan.club/wraps/previews/preview-2bb7b8ed-1769191291027.png', 'cybertruck', false, '红色背景，七龙珠', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('2c23153b-2f71-4f32-9b46-08032b37261f', 'Vintage Gradient', 'official', 'https://cdn.tewan.club/catalog/model-y-pre-2025/wraps/Official/Vintage_Gradient.png', 'https://cdn.tewan.club/previews/model-y-pre-2025/model-y-pre-2025-official-vintage-gradient.png', 'model-y', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('2cd481cd-35b1-44c2-bd0d-4a178c8a25a8', 'Dot Matrix', 'official', 'https://cdn.tewan.club/catalog/model-y-pre-2025/wraps/Official/Dot_Matrix.png', 'https://cdn.tewan.club/previews/model-y-pre-2025/model-y-pre-2025-official-dot-matrix.png', 'model-y', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('2cdc5b7c-d11b-43d4-983a-6b0be9a8de40', '银箭疾速 M3', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-03d7582f-1769484898117.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'https://cdn.tewan.club/wraps/ai-generated/wrap-03d7582f-1769484898117.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'model-3', false, '生成F1 梅赛德斯车队 车身涂装', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('2d08d836-d356-425d-9221-c686aeb0c3e4', 'Dot Matrix', 'official', 'https://cdn.tewan.club/catalog/model-y-2025-plus/wraps/Official/Dot_Matrix.png', 'https://cdn.tewan.club/previews/model-y-2025-plus/model-y-2025-plus-official-dot-matrix.png', 'model-y-2025-standard', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('2d1c0f24-12a7-4515-a183-b7e73b274f4b', 'Xray', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Xray.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-xray.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('2d420e00-8863-481a-84e7-0cbe383356ab', 'Grandmas Sofa', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Grandmas_Sofa.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-grandmas-sofa.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('2f60a455-7cd4-47a1-8b3f-c23190a6ad98', 'Woody', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Woody.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-woody.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('307ea69d-9f9b-4cfd-a264-8cfa33e8004c', '黄色背景，七龙珠主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/migrated-307ea69d-1769191171000.png', 'https://cdn.tewan.club/wraps/previews/preview-307ea69d-1769191302164.png', 'cybertruck', false, '黄色背景，七龙珠主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('31117ded-9b0e-4fb4-ba43-6aaf5d29cecb', 'Camo Brown', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Camo_Brown.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-camo-brown.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('341e665f-e905-44b2-b259-a0cae45f8951', 'Graffiti green', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Graffiti_green.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-graffiti-green.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('346f3cac-8e2a-49b4-900f-25cb8194fbda', '黄色车身，小黄人主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-68eb4030-1768967767106.png', 'https://cdn.tewan.club/wraps/previews/preview-346f3cac-1769191324385.png', 'model-y-2025-standard', false, '黄色车身，小黄人主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('34cd8692-47a7-468c-b019-bc1d6c483338', '红车身，赛车总动员闪电麦昆主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/migrated-34cd8692-1769191165462.png', 'https://cdn.tewan.club/wraps/previews/preview-34cd8692-1769191272612.png', 'cybertruck', false, '红车身，赛车总动员闪电麦昆主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('35f57366-823b-405b-bcd4-e44135ecf392', 'Leopard', 'official', 'https://cdn.tewan.club/catalog/model-3/wraps/Official/Leopard.png', 'https://cdn.tewan.club/previews/model-3/model-3-official-leopard.png', 'model-3', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('36135632-5a67-46fd-98fb-31286e2f2c8c', 'Clay', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Clay.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-clay.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('362a2ee6-654a-4f47-88f9-b5a62f593c4e', 'Leopard', 'official', 'https://cdn.tewan.club/catalog/model-y-2025-plus/wraps/Official/Leopard.png', 'https://cdn.tewan.club/previews/model-y-2025-plus/model-y-2025-plus-official-leopard.png', 'model-y-2025-standard', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('37c8f7d9-72af-4b3a-9b72-27689713095e', 'Divide', 'official', 'https://cdn.tewan.club/catalog/model-3-2024-plus/wraps/Official/Divide.png', 'https://cdn.tewan.club/previews/model-3-2024-plus/model-3-2024-plus-official-divide.png', 'model-3-2024', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('37cc8455-08fe-42e3-9617-2dab50a943f5', 'Valentine', 'official', 'https://cdn.tewan.club/catalog/model-y-2025-plus/wraps/Official/Valentine.png', 'https://cdn.tewan.club/previews/model-y-2025-plus/model-y-2025-plus-official-valentine.png', 'model-y-2025-standard', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('39b42e78-8757-428d-b75b-31b5e93493e4', 'Acid Drip', 'official', 'https://cdn.tewan.club/catalog/model-y-2025-plus/wraps/Official/Acid_Drip.png', 'https://cdn.tewan.club/previews/model-y-2025-plus/model-y-2025-plus-official-acid-drip.png', 'model-y-2025-standard', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('3a5ff3cf-ba0d-4584-8ab8-0d39d4b1f7e4', 'Apocalypse', 'official', 'https://cdn.tewan.club/catalog/model-y-2025-plus/wraps/Official/Apocalypse.png', 'https://cdn.tewan.club/previews/model-y-2025-plus/model-y-2025-plus-official-apocalypse.png', 'model-y-2025-standard', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('3c5f56b2-909e-4f06-9781-af01143d659e', 'Pixel Art', 'official', 'https://cdn.tewan.club/catalog/model-y-pre-2025/wraps/Official/Pixel_Art.png', 'https://cdn.tewan.club/previews/model-y-pre-2025/model-y-pre-2025-official-pixel-art.png', 'model-y', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('3cfc4c3a-033f-4112-8be4-c8dbd654d380', 'Apocalypse', 'official', 'https://cdn.tewan.club/catalog/model-y-pre-2025/wraps/Official/Apocalypse.png', 'https://cdn.tewan.club/previews/model-y-pre-2025/model-y-pre-2025-official-apocalypse.png', 'model-y', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('3d8974dc-6fca-4b6e-8ec3-50d63a628176', '黄色车身，小黄人主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-868632e9-1768973488292.png', 'https://cdn.tewan.club/wraps/previews/preview-3d8974dc-1769191320659.png', 'model-y-2025-standard', false, '黄色车身，小黄人主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('3d999a98-344a-44c0-801f-5bc27effb18d', 'Sakura', 'official', 'https://cdn.tewan.club/catalog/model-3-2024-plus/wraps/Official/Sakura.png', 'https://cdn.tewan.club/previews/model-3-2024-plus/model-3-2024-plus-official-sakura.png', 'model-3-2024', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('3dacecca-0735-49fd-8e63-44fa79c8faa6', '参考这张图，生成车贴', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-70ae7fbf-1769061375537.png', 'https://cdn.tewan.club/wraps/previews/preview-3dacecca-1769189747505.png', 'model-y-2025-standard', true, '参考这张图，生成车贴', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('3f239800-51ee-4908-b410-16a9f9260c44', '红色底色，超燃火焰主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-0eba510e-1769332254452.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'https://cdn.tewan.club/wraps/ai-generated/wrap-0eba510e-1769332254452.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'model-y', false, '红色底色，超燃火焰主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('4398510e-5022-4e8f-a8a3-0a59f458dd31', '红色火焰主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-abf4b989-1769332190779.png?x-oss-process=image/rotate,90/resize,w_1024,h_768', 'https://cdn.tewan.club/wraps/ai-generated/wrap-abf4b989-1769332190779.png?x-oss-process=image/rotate,90/resize,w_1024,h_768', 'cybertruck', false, '红色火焰主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('4503da8a-03c0-456b-a172-6adc4cff5123', 'Ani', 'official', 'https://cdn.tewan.club/catalog/model-y-2025-plus/wraps/Official/Ani.png', 'https://cdn.tewan.club/previews/model-y-2025-plus/model-y-2025-plus-official-ani.png', 'model-y-2025-standard', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('47fa45ac-6a41-49f8-aa5c-62e1a5ef1798', 'Leopard', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Leopard.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-leopard.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('4892da67-0f81-44a0-a322-e0a31e34c7b2', 'Camo Sand', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Camo_Sand.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-camo-sand.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('490b870b-cdd5-49d5-ba51-4e6bbec21bc3', 'Vintage Stripes', 'official', 'https://cdn.tewan.club/catalog/model-y-2025-plus/wraps/Official/Vintage_Stripes.png', 'https://cdn.tewan.club/previews/model-y-2025-plus/model-y-2025-plus-official-vintage-stripes.png', 'model-y-2025-standard', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('49185d9a-ba6d-40b0-9bec-c6db087786ab', '紫色蝴蝶主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-5afe688d-1769237963166.png', 'https://cdn.tewan.club/wraps/ai-generated/wrap-5afe688d-1769237963166.png', 'cybertruck', false, '紫色蝴蝶主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('49bd88c4-fe7b-43f9-86de-c46c585a3aa6', 'Gradient Black', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Gradient_Black.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-gradient-black.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('4a8334bd-289c-4951-af8d-0e235947cd14', '海军迷彩', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-4db60f59-1769329079963.png?x-oss-process=image/rotate,90/resize,w_1024,h_768', 'https://cdn.tewan.club/wraps/previews/preview-4a8334bd-1769329102366.png', 'cybertruck', true, '海军迷彩', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('4acb2544-8086-4af8-b1ad-58bc68880044', 'Vintage Stripes', 'ai_generated', 'https://cdn.tewan.club/catalog/model-y-pre-2025/wraps/Official/Vintage_Stripes.png', 'https://cdn.tewan.club/previews/model-y-pre-2025/model-y-pre-2025-official-vintage-stripes.png', 'model-y', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('4e8f0300-44e8-43b3-868b-0e936097438d', 'Sakura', 'official', 'https://cdn.tewan.club/catalog/model-y-pre-2025/wraps/Official/Sakura.png', 'https://cdn.tewan.club/previews/model-y-pre-2025/model-y-pre-2025-official-sakura.png', 'model-y', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('4fb9cebd-2804-4202-a992-c0ef7c23b72b', 'NASA车身涂装', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-0133b4f0-1768915758714.png', 'https://cdn.tewan.club/wraps/previews/preview-4fb9cebd-1768965231863.png', 'model-3', false, 'NASA车身涂装', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('4ffd5349-773c-4a05-afa9-c2a6363095a9', '蓝色车身，疯狂动物城主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/migrated-4ffd5349-1769191167915.png', 'https://cdn.tewan.club/wraps/previews/preview-4ffd5349-1769191276317.png', 'cybertruck', false, '蓝色车身，疯狂动物城主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('51352532-1600-47fe-ac67-82472764aa4c', 'Digital Camo Snow', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Digital_Camo_Snow.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-digital-camo-snow.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('51e8adbd-23d5-4815-8295-e2c76a800793', '星际酷甜驾', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-73fa2094-1769485175600.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'https://cdn.tewan.club/wraps/ai-generated/wrap-73fa2094-1769485175600.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'model-3', false, '泡泡玛特星星人主题，整体色调跟星星人的主色系相符，风格俏皮甜酷，我希望车身侧面也有星星人的形象', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('53ad0833-2e98-4323-9157-e73da09f067e', 'Vintage Gradient', 'official', 'https://cdn.tewan.club/catalog/model-y-2025-plus/wraps/Official/Vintage_Gradient.png', 'https://cdn.tewan.club/previews/model-y-2025-plus/model-y-2025-plus-official-vintage-gradient.png', 'model-y-2025-standard', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('53c3e1cb-8a7a-48aa-aed8-12b9d2fbc5b9', '银箭Y号', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-3c083685-1769493117423.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'https://cdn.tewan.club/wraps/previews/preview-53c3e1cb-1769671236947.png', 'model-y', true, '参考图片，生成F1梅赛德斯车队赛车涂装', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('55242953-67e1-461d-bff9-351a264dbd5f', '粉色蝴蝶主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-dafc3c8b-1769239439413.png', 'https://cdn.tewan.club/wraps/previews/preview-55242953-1769257170214.png', 'model-3-2024', true, '粉色蝴蝶主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('553b0872-ff64-4c7a-a009-5d0b54fe27c5', 'Mika', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Mika.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-mika.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('575dfbfe-6645-45df-86f8-1eeec90ff95f', 'Divide', 'official', 'https://cdn.tewan.club/catalog/model-y-2025-plus/wraps/Official/Divide.png', 'https://cdn.tewan.club/previews/model-y-2025-plus/model-y-2025-plus-official-divide.png', 'model-y-2025-standard', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('57812cf1-0628-4af5-add1-808f114868a1', 'Reindeer', 'official', 'https://cdn.tewan.club/catalog/model-y-pre-2025/wraps/Official/Reindeer.png', 'https://cdn.tewan.club/previews/model-y-pre-2025/model-y-pre-2025-official-reindeer.png', 'model-y', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('5859ebd1-e10b-40ee-b41a-af340aba41dd', '甜酷星愿', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-70437be9-1769484767070.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'https://cdn.tewan.club/wraps/ai-generated/wrap-70437be9-1769484767070.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'model-3', false, '泡泡玛特星星人主题，整体色调跟星星人的主色系相符，风格俏皮甜酷', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('58b25a5a-eead-4d15-97d7-4f7a781fa355', 'Avocado Green', 'official', 'https://cdn.tewan.club/catalog/model-3/wraps/Official/Avocado_Green.png', 'https://cdn.tewan.club/previews/model-3/model-3-official-avocado-green.png', 'model-3', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('59fa4ec3-7321-4ab0-ad72-e3c381a383ea', '蓝色车身，疯狂动物城主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/migrated-59fa4ec3-1769191167197.png', 'https://cdn.tewan.club/wraps/previews/preview-59fa4ec3-1769191280004.png', 'cybertruck', false, '蓝色车身，疯狂动物城主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('5a381fb7-9456-4862-b286-e34c3191e1f8', 'Graffiti orange', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Graffiti_orange.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-graffiti-orange.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('5d543a29-2d3a-4003-9159-96df6b19ff2d', 'Pixel Art', 'official', 'https://cdn.tewan.club/catalog/model-3/wraps/Official/Pixel_Art.png', 'https://cdn.tewan.club/previews/model-3/model-3-official-pixel-art.png', 'model-3', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('60c9242b-4b67-474e-bbab-b9e5b181767d', 'Camo Snow', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Camo_Snow.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-camo-snow.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('6435268c-bd8e-4d9e-9a73-f18d6f6933df', 'Rudi', 'official', 'https://cdn.tewan.club/catalog/model-3-2024-plus/wraps/Official/Rudi.png', 'https://cdn.tewan.club/previews/model-3-2024-plus/model-3-2024-plus-official-rudi.png', 'model-3-2024', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('6b5a3b1f-d621-4976-83d3-005a474d241e', '火焰主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-c3d96608-1769331085010.png?x-oss-process=image/rotate,90/resize,w_1024,h_768', 'https://cdn.tewan.club/wraps/ai-generated/wrap-c3d96608-1769331085010.png?x-oss-process=image/rotate,90/resize,w_1024,h_768', 'cybertruck', false, '火焰主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('6bdf4347-e8a4-4cc0-ad95-a6f875f7f23e', 'super junior 20周年主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-e54495fb-1769011614016.png', 'https://cdn.tewan.club/wraps/previews/preview-6bdf4347-1769189791373.png', 'model-y', true, 'super junior 20周年主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('6bf2ef24-932b-4f68-aea7-4c655b869357', '疯狂动物城朱迪警官主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/migrated-6bf2ef24-1769191166513.png', 'https://cdn.tewan.club/wraps/previews/preview-6bf2ef24-1769191287351.png', 'cybertruck', false, '疯狂动物城朱迪警官主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('6ee57c0a-e172-40fb-8dbf-d8b8ab0526a8', 'Gradient Purple Burn', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Gradient_Purple_Burn.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-gradient-purple-burn.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('6feb2ce1-2d27-4f8e-8e1b-3cafe25639fb', 'Dot Matrix', 'official', 'https://cdn.tewan.club/catalog/model-3/wraps/Official/Dot_Matrix.png', 'https://cdn.tewan.club/previews/model-3/model-3-official-dot-matrix.png', 'model-3', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('71cdedca-4f52-4597-9f52-37e34f9a4428', 'String Lights', 'official', 'https://cdn.tewan.club/catalog/model-y-pre-2025/wraps/Official/String_Lights.png', 'https://cdn.tewan.club/previews/model-y-pre-2025/model-y-pre-2025-official-string-lights.png', 'model-y', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('729cb11a-1b3e-49bb-be2a-e944b980f4af', '甜酷星际漫游', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-1c649ea9-1769484970884.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'https://cdn.tewan.club/wraps/ai-generated/wrap-1c649ea9-1769484970884.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'model-3', false, '泡泡玛特星星人主题，整体色调跟星星人的主色系相符，风格俏皮甜酷', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('73ed1fb0-9d09-435c-ab39-39ac14c0d708', 'Dot Matrix', 'official', 'https://cdn.tewan.club/catalog/model-3-2024-plus/wraps/Official/Dot_Matrix.png', 'https://cdn.tewan.club/previews/model-3-2024-plus/model-3-2024-plus-official-dot-matrix.png', 'model-3-2024', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('73eff8c1-c8ea-4e0f-94b1-2b842fe49092', 'Gradient Cotton Candy', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Gradient_Cotton_Candy.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-gradient-cotton-candy.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('772febf6-a6f1-4ed1-95ac-2ce237500ccb', 'Cosmic Burst', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Cosmic_Burst.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-cosmic-burst.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('77c2f6a6-0af0-4901-8b3c-a5acb0d8e154', 'Doge', 'official', 'https://cdn.tewan.club/catalog/model-y-2025-plus/wraps/Official/Doge.png', 'https://cdn.tewan.club/previews/model-y-2025-plus/model-y-2025-plus-official-doge.png', 'model-y-2025-standard', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('7806cc73-4cae-4196-8677-c49f0017d5b8', '星球大战主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-57fe0c6d-1768993303886.png', 'https://cdn.tewan.club/wraps/previews/preview-7806cc73-1769189801141.png', 'model-3', true, '星球大战主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('78d681ae-1ea2-4b04-a29f-6d073ad948d4', 'Pixel Art', 'official', 'https://cdn.tewan.club/catalog/model-y-2025-plus/wraps/Official/Pixel_Art.png', 'https://cdn.tewan.club/previews/model-y-2025-plus/model-y-2025-plus-official-pixel-art.png', 'model-y-2025-standard', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('78f72081-72a1-477c-b1c6-d2fd1f4020f6', '粉丝车身，小马宝莉紫悦主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/migrated-78f72081-1769191172595.png', 'https://cdn.tewan.club/wraps/previews/preview-78f72081-1769191268868.png', 'cybertruck', true, '粉丝车身，小马宝莉紫悦主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('7ab5088a-ab94-4716-be0a-085b06ef7d22', 'Ani', 'official', 'https://cdn.tewan.club/catalog/model-3/wraps/Official/Ani.png', 'https://cdn.tewan.club/previews/model-3/model-3-official-ani.png', 'model-3', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('7adf84f2-0f6d-49a4-aba0-dacebe2ced8c', 'Valentine', 'official', 'https://cdn.tewan.club/catalog/model-3-2024-plus/wraps/Official/Valentine.png', 'https://cdn.tewan.club/previews/model-3-2024-plus/model-3-2024-plus-official-valentine.png', 'model-3-2024', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('7b96ff61-d842-455f-b6c6-d713dc7b2956', '经典竞速', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-72526459-1769351621426.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'https://cdn.tewan.club/wraps/previews/preview-7b96ff61-1769351684672.png', 'model-3-2024', true, '复古赛车涂装', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('7d59f58a-0e12-4150-821d-e8aaa93c33a0', '一个鬼', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-40919cfa-1769236576633.png', 'https://cdn.tewan.club/wraps/ai-generated/wrap-40919cfa-1769236576633.png', 'cybertruck', false, '一个鬼', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('7d656547-93d7-4f4f-905f-9bfd80da550a', 'Camo', 'official', 'https://cdn.tewan.club/catalog/model-3-2024-plus/wraps/Official/Camo.png', 'https://cdn.tewan.club/previews/model-3-2024-plus/model-3-2024-plus-official-camo.png', 'model-3-2024', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('80a5f730-9af5-4ea2-b9cf-cc73e6d833d1', '宇宙主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-b13f38fc-1769329970595.png?x-oss-process=image/rotate,90/resize,w_1024,h_768', 'https://cdn.tewan.club/wraps/ai-generated/wrap-b13f38fc-1769329970595.png?x-oss-process=image/rotate,90/resize,w_1024,h_768', 'cybertruck', false, '宇宙主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('80d6d382-8281-4139-89eb-6eb6feb59c4b', 'Ice Cream', 'official', 'https://cdn.tewan.club/catalog/model-y-2025-plus/wraps/Official/Ice_Cream.png', 'https://cdn.tewan.club/previews/model-y-2025-plus/model-y-2025-plus-official-ice-cream.png', 'model-y-2025-standard', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('812d9b7d-278c-4b2c-88c9-486d11494135', '粉色蝴蝶主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-b3f8a96f-1769239378902.png', 'https://cdn.tewan.club/wraps/ai-generated/wrap-b3f8a96f-1769239378902.png', 'cybertruck', false, '粉色蝴蝶主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('81300ddf-aafa-4abc-a588-7f60913316a7', '甜酷星际M3', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-b557d8d7-1769485373671.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'https://cdn.tewan.club/wraps/previews/preview-81300ddf-1769485505975.png', 'model-3', true, '泡泡玛特星星人主题，整体色调跟星星人的主色系相符，风格俏皮甜酷，我希望车身侧面也有星星人的形象。底色能否参考第一张图的背景色', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('8343816e-f00f-45e4-ac00-675f62ae3ac1', 'labubu 主题，车身颜色以红和棕为主，labubu 形象用象棋大国王的哪一款', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-7980a3cb-1769053969880.png', 'https://cdn.tewan.club/wraps/previews/preview-8343816e-1769197328985.png', 'model-y', true, 'labubu 主题，车身颜色以红和棕为主，labubu 形象用象棋大国王的哪一款', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('83c06a88-17c9-42c5-b060-7ae224b0bfe6', 'Camo Green', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Camo_Green.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-camo-green.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('848c5e0a-f9ef-419d-a29c-d3e8eba2d006', 'Apocalypse', 'official', 'https://cdn.tewan.club/catalog/model-3/wraps/Official/Apocalypse.png', 'https://cdn.tewan.club/previews/model-3/model-3-official-apocalypse.png', 'model-3', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('84e6da7e-c28a-4513-ac5d-609e4aaf2426', 'String Lights', 'official', 'https://cdn.tewan.club/catalog/model-3-2024-plus/wraps/Official/String_Lights.png', 'https://cdn.tewan.club/previews/model-3-2024-plus/model-3-2024-plus-official-string-lights.png', 'model-3-2024', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('86b3615a-2a24-4f01-8919-6c7f0a02e406', '彩虹凤凰主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-8a73c463-1769252954040.png', 'https://cdn.tewan.club/wraps/previews/preview-86b3615a-1769255321764.png', 'model-y', true, '彩虹凤凰主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('89513842-df5a-474e-a865-ec928e552618', 'Leopard', 'official', 'https://cdn.tewan.club/catalog/model-y-pre-2025/wraps/Official/Leopard.png', 'https://cdn.tewan.club/previews/model-y-pre-2025/model-y-pre-2025-official-leopard.png', 'model-y', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('8bbc84f1-05b4-4922-bc7e-9d0d760c0b28', '时风三轮车', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-f4abf848-1769326714902.png?x-oss-process=image/rotate,90/resize,w_1024,h_768', 'https://cdn.tewan.club/wraps/ai-generated/wrap-f4abf848-1769326714902.png?x-oss-process=image/rotate,90/resize,w_1024,h_768', 'cybertruck', false, '时风三轮车', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('8d4346ed-b051-4fe4-a692-36594aa4013a', 'Doge', 'official', 'https://cdn.tewan.club/catalog/model-y-pre-2025/wraps/Official/Doge.png', 'https://cdn.tewan.club/previews/model-y-pre-2025/model-y-pre-2025-official-doge.png', 'model-y', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('8f2345ad-08c6-43c7-9084-c1a158feef97', 'Doge', 'official', 'https://cdn.tewan.club/catalog/model-3-2024-plus/wraps/Official/Doge.png', 'https://cdn.tewan.club/previews/model-3-2024-plus/model-3-2024-plus-official-doge.png', 'model-3-2024', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('8fcc3192-c364-40c7-9cb2-0e16e2cd5608', '工程救援车', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-05dd877d-1769239673645.png', 'https://cdn.tewan.club/wraps/ai-generated/wrap-05dd877d-1769239673645.png', 'cybertruck', false, '工程救援车', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('90630209-9850-4a3e-98b8-7acfd3e08ad8', '奔驰F1战甲', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-ec34f2c0-1769484526839.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'https://cdn.tewan.club/wraps/ai-generated/wrap-ec34f2c0-1769484526839.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'model-3', false, '生成F1 梅赛德斯车队 车身涂装', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('91c624e3-501c-423c-858d-4728d7af02a9', '梵高星空', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-a7d2872e-1769326615474.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'https://cdn.tewan.club/wraps/previews/preview-91c624e3-1769326655718.png', 'model-y-2025-standard', true, '梵高星空', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('964899ab-3068-44d3-b40c-c83316011f67', '小猪佩奇主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-f05699c2-1769329645787.png?x-oss-process=image/rotate,90/resize,w_1024,h_768', 'https://cdn.tewan.club/wraps/ai-generated/wrap-f05699c2-1769329645787.png?x-oss-process=image/rotate,90/resize,w_1024,h_768', 'cybertruck', false, '小猪佩奇主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('9839166f-a473-469c-a22f-fcb41a548d31', 'Ani', 'official', 'https://cdn.tewan.club/catalog/model-y-pre-2025/wraps/Official/Ani.png', 'https://cdn.tewan.club/previews/model-y-pre-2025/model-y-pre-2025-official-ani.png', 'model-y', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('9904d646-e08f-4f99-bdef-94c9bbb8e820', 'Sketch', 'official', 'https://cdn.tewan.club/catalog/model-y-2025-plus/wraps/Official/Sketch.png', 'https://cdn.tewan.club/previews/model-y-2025-plus/model-y-2025-plus-official-sketch.png', 'model-y-2025-standard', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('9a33a97f-a442-4e56-b1f2-a3211a7b96f1', '红色底色，超燃火焰主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-e936528c-1769340327399.png?x-oss-process=image/rotate,90/resize,w_1024,h_768', 'https://cdn.tewan.club/wraps/ai-generated/wrap-e936528c-1769340327399.png?x-oss-process=image/rotate,90/resize,w_1024,h_768', 'cybertruck', false, '红色底色，超燃火焰主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('9a36f245-94c5-42b4-8a83-13d76080bd21', '气球主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-bd4b864d-1769326472129.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'https://cdn.tewan.club/wraps/ai-generated/wrap-bd4b864d-1769326472129.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'model-y-2025-standard', false, '气球主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('9a5363d3-45f2-4feb-b7c0-7d7b4d8d9372', 'Camo Blue', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Camo_Blue.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-camo-blue.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('9c62d689-8639-430d-a989-8164a7a2b6a9', 'police', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/police.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-police.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('9ddbd141-436b-4dde-847f-b7df8dec37ec', '蓝色蝴蝶主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-89b0b5d5-1769239117370.png', 'https://cdn.tewan.club/wraps/ai-generated/wrap-89b0b5d5-1769239117370.png', 'cybertruck', false, '蓝色蝴蝶主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('a002571f-f421-496e-a491-2753d39b5816', 'Gradient Burn', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Gradient_Burn.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-gradient-burn.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('a1f34c3d-96cf-457d-8b52-d6c182e0f6cd', 'Ice Cream', 'official', 'https://cdn.tewan.club/catalog/model-y-pre-2025/wraps/Official/Ice_Cream.png', 'https://cdn.tewan.club/previews/model-y-pre-2025/model-y-pre-2025-official-ice-cream.png', 'model-y', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('a2c60f42-9ccb-46e2-bdf4-ca6056275ce4', 'Leopard', 'official', 'https://cdn.tewan.club/catalog/model-3-2024-plus/wraps/Official/Leopard.png', 'https://cdn.tewan.club/previews/model-3-2024-plus/model-3-2024-plus-official-leopard.png', 'model-3-2024', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('a39227f0-d73f-49f9-86b7-48f8882ff844', 'Acid Drip', 'official', 'https://cdn.tewan.club/catalog/model-y-pre-2025/wraps/Official/Acid_Drip.png', 'https://cdn.tewan.club/previews/model-y-pre-2025/model-y-pre-2025-official-acid-drip.png', 'model-y', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('a3fab5df-fe02-473e-9778-8a91ebdf6182', 'Gradient Sunburst', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Gradient_Sunburst.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-gradient-sunburst.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('a5f839d3-4eaf-4d75-99a5-e885b869befc', '海绵宝宝主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/migrated-a5f839d3-1769191173517.png', 'https://cdn.tewan.club/wraps/previews/preview-a5f839d3-1769191400164.png', 'model-3', true, '海绵宝宝主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('a6240827-5ae2-43f2-ac86-9a95f683ec35', 'Divide', 'official', 'https://cdn.tewan.club/catalog/model-3/wraps/Official/Divide.png', 'https://cdn.tewan.club/previews/model-3/model-3-official-divide.png', 'model-3', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('a83d1caf-6c0e-4985-a379-98f83315899f', '超级玛丽主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-bd615373-1769329340484.png?x-oss-process=image/rotate,90/resize,w_1024,h_768', 'https://cdn.tewan.club/wraps/ai-generated/wrap-bd615373-1769329340484.png?x-oss-process=image/rotate,90/resize,w_1024,h_768', 'cybertruck', false, '超级玛丽主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('a89d6a44-81d5-4f92-8742-7d37f9ceef55', 'Retro', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Retro.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-retro.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('abdd498a-ff9f-4229-b287-5ce3981e8f86', '英国警车', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-4c8c379a-1769240491070.png', 'https://cdn.tewan.club/wraps/ai-generated/wrap-4c8c379a-1769240491070.png', 'cybertruck', false, '英国警车', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('acf6fd66-2f16-4e06-ae17-c45c36aad463', 'Sakura', 'official', 'https://cdn.tewan.club/catalog/model-y-2025-plus/wraps/Official/Sakura.png', 'https://cdn.tewan.club/previews/model-y-2025-plus/model-y-2025-plus-official-sakura.png', 'model-y-2025-standard', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('ada3c141-954f-4595-b215-d169c516151d', 'Cosmic Burst', 'official', 'https://cdn.tewan.club/catalog/model-3/wraps/Official/Cosmic_Burst.png', 'https://cdn.tewan.club/previews/model-3/model-3-official-cosmic-burst.png', 'model-3', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('ae3623da-b183-4fb6-b80b-7b57b662c638', '彩色气球主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-233b8211-1769324488675.png', 'https://cdn.tewan.club/wraps/ai-generated/wrap-233b8211-1769324488675.png', 'model-y-2025-standard', false, '彩色气球主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('aea30a87-8efe-44e4-91d2-66c89afb1bd1', 'HelloKitty主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-ac79f33c-1769196392613.png', 'https://cdn.tewan.club/wraps/previews/preview-aea30a87-1769220186856.png', 'model-y-2025-standard', true, 'HelloKitty主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('afa4c5cc-6290-4ea6-b136-8d710a784eb5', '蓝色背景，叮当猫主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/migrated-afa4c5cc-1769191168614.jpeg', 'https://cdn.tewan.club/wraps/previews/preview-afa4c5cc-1769191316945.png', 'cybertruck', false, '蓝色背景，叮当猫主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('afda04ad-08d4-463f-a5b4-45dfb144c646', 'String Lights', 'official', 'https://cdn.tewan.club/catalog/model-y-2025-plus/wraps/Official/String_Lights.png', 'https://cdn.tewan.club/previews/model-y-2025-plus/model-y-2025-plus-official-string-lights.png', 'model-y-2025-standard', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('b243c5c7-bdd7-40dc-96b8-5b06e5d0db18', '极速黑鲨', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-50aa1d3d-1769671324356.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'https://cdn.tewan.club/wraps/previews/preview-b243c5c7-1769671378537.png', 'model-y-2025-standard', true, '鲨鱼车身，整车像一条鲨鱼，背部黑色，腹部白色，车头有牙齿，机盖上有眼睛', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('b59f31a6-e8f3-452a-b031-cdc58fd135b1', 'String Lights', 'official', 'https://cdn.tewan.club/catalog/model-3/wraps/Official/String_Lights.png', 'https://cdn.tewan.club/previews/model-3/model-3-official-string-lights.png', 'model-3', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('b65b219c-aaae-4110-9ba4-153efbd3444d', 'Digital Camo Stealth', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Digital_Camo_Stealth.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-digital-camo-stealth.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('b6db9571-b5c9-426e-83e1-45d3680dc6dd', 'Vintage Stripes', 'official', 'https://cdn.tewan.club/catalog/model-3-2024-plus/wraps/Official/Vintage_Stripes.png', 'https://cdn.tewan.club/previews/model-3-2024-plus/model-3-2024-plus-official-vintage-stripes.png', 'model-3-2024', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('b7a7dc71-3cb4-4d0e-8fa7-efbceb99f53a', 'Doge Camo', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Doge_Camo.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-doge-camo.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('b8228c43-18a6-40d1-bc31-557b1ab4bd01', '中国警车', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-8124f7f6-1768988986743.png', 'https://cdn.tewan.club/wraps/ai-generated/wrap-8124f7f6-1768988986743.png', 'cybertruck', false, '中国警车', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('bafc22b0-c716-41bf-a54e-1c6b126b215a', 'DIY Sticker', 'diy', 'https://cdn.tewan.club/wraps/diy/diy-18f8f-24778ff8-1769064698888.png', 'https://cdn.tewan.club/wraps/previews/preview-bafc22b0-1769190246434.png', 'cybertruck', false, 'DIY Sticker', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('bb35b60e-abec-424b-8d87-134f1c537e56', 'Doge', 'official', 'https://cdn.tewan.club/catalog/model-3/wraps/Official/Doge.png', 'https://cdn.tewan.club/previews/model-3/model-3-official-doge.png', 'model-3', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('bb488f98-3093-45c6-9f32-11d7db8ce39f', '气球主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-51df8480-1769326557264.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'https://cdn.tewan.club/wraps/ai-generated/wrap-51df8480-1769326557264.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'model-y', false, '气球主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('bb9029b2-62a2-42a0-a289-6eb96b233abb', 'Xmas Lights', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Xmas_Lights.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-xmas-lights.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('be76cc44-79c1-4da9-bc0f-841242e82f16', 'DIY Sticker', 'diy', 'https://cdn.tewan.club/wraps/diy/diy-18f8f-7b3a35d9-1769065028314.png', 'https://cdn.tewan.club/wraps/previews/preview-be76cc44-1769190238438.png', 'cybertruck', true, 'DIY Sticker', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('c0620718-288d-4c17-a94d-f1d9a5b1940c', 'Valentine', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Valentine.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-valentine.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('c2044818-1167-41df-a77d-f49b90088861', '小黄人主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-5c0e6e76-1769193858911.png', 'https://cdn.tewan.club/wraps/previews/preview-c2044818-1769196664099.png', 'model-y-2025-standard', true, '小黄人主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('c264732b-a1f6-4167-ae16-263ad9997c59', 'Ani', 'official', 'https://cdn.tewan.club/catalog/model-3-2024-plus/wraps/Official/Ani.png', 'https://cdn.tewan.club/previews/model-3-2024-plus/model-3-2024-plus-official-ani.png', 'model-3-2024', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('c3902aad-45e1-40d7-a14f-2448caf40c8e', 'Rudi', 'official', 'https://cdn.tewan.club/catalog/model-y-pre-2025/wraps/Official/Rudi.png', 'https://cdn.tewan.club/previews/model-y-pre-2025/model-y-pre-2025-official-rudi.png', 'model-y', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('c4ee4471-8828-41c2-8c5e-607baa09f6e6', 'Graffiti back', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Graffiti_back.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-graffiti-back.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('c7cbc4e4-236c-45af-9322-46d86e5d35fc', 'Acid Drip', 'official', 'https://cdn.tewan.club/catalog/model-3-2024-plus/wraps/Official/Acid_Drip.png', 'https://cdn.tewan.club/previews/model-3-2024-plus/model-3-2024-plus-official-acid-drip.png', 'model-3-2024', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('c96fc4ad-71ea-40c8-8411-cf32c42929ae', 'DIY Sticker', 'diy', 'https://cdn.tewan.club/wraps/diy/diy-18f8f-24778ff8-1769064699821.png', 'https://cdn.tewan.club/wraps/previews/preview-c96fc4ad-1769190242574.png', 'cybertruck', true, 'DIY Sticker', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('ca8608f2-ea33-4d4f-8a7a-9f7f3acb5e9f', '美国警车', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-7d8f4fb7-1768988521355.png', 'https://cdn.tewan.club/wraps/previews/preview-ca8608f2-1769190107797.png', 'cybertruck', true, '美国警车', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('cbcdf598-1cde-417d-9acd-8a4efdab7074', 'Reindeer', 'official', 'https://cdn.tewan.club/catalog/model-y-2025-plus/wraps/Official/Reindeer.png', 'https://cdn.tewan.club/previews/model-y-2025-plus/model-y-2025-plus-official-reindeer.png', 'model-y-2025-standard', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('cccf7913-c6ea-49cb-a5f8-1312a1a13348', '红色新年', 'ai_generated', 'https://cdn.tewan.club/wraps/wrap-3d7cb26e-1768992801840.png', 'https://cdn.tewan.club/wraps/previews/preview-cccf7913-1769189804858.png', 'model-3', true, '红色新年', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('cffa72b5-7067-4d9b-995c-ee0f605519c1', 'Reindeer', 'official', 'https://cdn.tewan.club/catalog/model-3-2024-plus/wraps/Official/Reindeer.png', 'https://cdn.tewan.club/previews/model-3-2024-plus/model-3-2024-plus-official-reindeer.png', 'model-3-2024', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('d3f10614-47fe-463a-a808-0417eda2ba46', '蓝色背景，机器猫主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-8d615f77-1768967496845.png', 'https://cdn.tewan.club/wraps/previews/wrap-8d615f77-1768967496845.png', 'model-y-2025-standard', false, '蓝色背景，机器猫主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('d40c4841-f976-458c-a479-6fdfeb59b4e2', 'Avocado Green', 'official', 'https://cdn.tewan.club/catalog/model-y-pre-2025/wraps/Official/Avocado_Green.png', 'https://cdn.tewan.club/previews/model-y-pre-2025/model-y-pre-2025-official-avocado-green.png', 'model-y', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('d5da1b91-dcb9-4495-b95e-37f37aa7727b', 'Ice Cream', 'official', 'https://cdn.tewan.club/catalog/model-3-2024-plus/wraps/Official/Ice_Cream.png', 'https://cdn.tewan.club/previews/model-3-2024-plus/model-3-2024-plus-official-ice-cream.png', 'model-3-2024', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('d6505d55-2cc8-4f17-93cf-e1fd579b865d', '白色背景，美少女战士主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/migrated-d6505d55-1769191169183.png', 'https://cdn.tewan.club/wraps/previews/preview-d6505d55-1769191313211.png', 'cybertruck', false, '白色背景，美少女战士主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('d7d01e32-d99e-460d-8b9b-3f5ffe64780f', '极速米橙', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-b94ef408-1769674347445.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'https://cdn.tewan.club/wraps/ai-generated/wrap-b94ef408-1769674347445.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'model-3-2024', false, '小米ultra橙色车身拉花', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('d8b30d8e-5f65-428c-94e5-7878798a7f94', '红色背景，超级玛丽主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/migrated-d8b30d8e-1769191170604.png', 'https://cdn.tewan.club/wraps/previews/preview-d8b30d8e-1769191305823.png', 'cybertruck', false, '红色背景，超级玛丽主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('dd4b8e1c-ea5b-4cde-b265-78f114ab6746', 'Xmas Camo', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Xmas_Camo.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-xmas-camo.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('e01015a7-d64e-447d-972a-5d1289f8ee49', '蓝紫渐变', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-3304d381-1769351314616.png?x-oss-process=image/rotate,90/resize,w_1024,h_768', 'https://cdn.tewan.club/wraps/previews/preview-e01015a7-1769351365296.png', 'cybertruck', true, '蓝紫渐变', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('e228ef6f-e18b-4236-80b1-0f0114a29388', 'Vintage Gradient', 'official', 'https://cdn.tewan.club/catalog/model-3/wraps/Official/Vintage_Gradient.png', 'https://cdn.tewan.club/previews/model-3/model-3-official-vintage-gradient.png', 'model-3', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('e22b0427-d264-452e-9258-531dafbe3db1', '蓝色背景，机器猫主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-74179257-1768967613555.png', 'https://cdn.tewan.club/wraps/previews/preview-e22b0427-1769191328089.png', 'model-y', false, '蓝色背景，机器猫主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('e280a3a2-6e79-42f9-aa99-0fac3d3d1121', '生化危机车辆涂装', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-41f61621-1769321262372.png', 'https://cdn.tewan.club/wraps/ai-generated/wrap-41f61621-1769321262372.png', 'cybertruck', false, '生化危机车辆涂装', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('e2d57578-1114-4d04-bf06-0f53c15a837a', '海底世界主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-ba75dbff-1769319125783.png', 'https://cdn.tewan.club/wraps/previews/preview-e2d57578-1769319192478.png', 'model-y-2025-standard', true, '海底世界主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('e326aab2-8b64-4cb0-b06e-d0b74dac4bd3', '黄色车身，小黄人主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-981492ac-1768959203710.png', 'https://cdn.tewan.club/wraps/previews/preview-e326aab2-1768965361279.png', 'model-y', false, '黄色车身，小黄人主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('e524c653-1554-4382-832c-9f945c171778', '粉色车身，芭比主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-f3c61479-1768991824385.png', 'https://cdn.tewan.club/wraps/previews/preview-e524c653-1769189808811.png', 'model-3', true, '粉色车身，芭比主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('e7b13b73-d421-4bc2-b761-75d793fce62f', '黄色车身，小黄人主题', 'ai_generated', '/api/debug/assets?file=wrap-0d3dea0a-1768974772804.png', '/api/debug/assets?file=wrap-0d3dea0a-1768974772804.png', 'cybertruck', false, '黄色车身，小黄人主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('e801db8d-f7e3-4a48-9381-b2aa1135e789', '冰川之巅', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-0d1181d4-1769430601271.png?x-oss-process=image/rotate,90/resize,w_1024,h_768', 'https://cdn.tewan.club/wraps/previews/preview-e801db8d-1769430638833.png', 'cybertruck', true, '黑色车身，高级感的淡灰色雪山顶峰', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('e842331d-a19c-4a97-b1f9-a29d857a545d', 'Rc prototype', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Rc_prototype.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-rc-prototype.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('e9e1f532-3999-4c2c-b8f0-d72591191635', '紫色蝴蝶主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-aff082ff-1769238141691.png', 'https://cdn.tewan.club/wraps/ai-generated/wrap-aff082ff-1769238141691.png', 'cybertruck', false, '紫色蝴蝶主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('ea065ebe-a663-4d43-9870-8e0218673c32', 'Vintage Stripes', 'official', 'https://cdn.tewan.club/catalog/model-3/wraps/Official/Vintage_Stripes.png', 'https://cdn.tewan.club/previews/model-3/model-3-official-vintage-stripes.png', 'model-3', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('ec603d26-5cd2-44b7-8e21-bd502061abc7', '粉色车身，小马宝莉紫悦主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/migrated-ec603d26-1769191173944.png', 'https://cdn.tewan.club/wraps/previews/preview-ec603d26-1769191264883.png', 'model-3', true, '粉色车身，小马宝莉紫悦主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('ecbb19c7-f068-468b-a8a2-3ec78fb5cd48', 'Vintage Gradient', 'official', 'https://cdn.tewan.club/catalog/model-3-2024-plus/wraps/Official/Vintage_Gradient.png', 'https://cdn.tewan.club/previews/model-3-2024-plus/model-3-2024-plus-official-vintage-gradient.png', 'model-3-2024', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('efc17cf1-15a2-443e-a746-0910ecd70356', 'Apocalypse', 'official', 'https://cdn.tewan.club/catalog/model-3-2024-plus/wraps/Official/Apocalypse.png', 'https://cdn.tewan.club/previews/model-3-2024-plus/model-3-2024-plus-official-apocalypse.png', 'model-3-2024', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('f01ac3f0-4a6c-4704-8e4d-8a6272a4928d', 'Avocado Green', 'official', 'https://cdn.tewan.club/catalog/model-y-2025-plus/wraps/Official/Avocado_Green.png', 'https://cdn.tewan.club/previews/model-y-2025-plus/model-y-2025-plus-official-avocado-green.png', 'model-y-2025-standard', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('f26919aa-27fe-498c-a72f-0831ceca6566', 'Cosmic Burst', 'official', 'https://cdn.tewan.club/catalog/model-y-2025-plus/wraps/Official/Cosmic_Burst.png', 'https://cdn.tewan.club/previews/model-y-2025-plus/model-y-2025-plus-official-cosmic-burst.png', 'model-y-2025-standard', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('f52a5f45-1f95-4318-a8dc-e9f57a8ba44a', 'Digital Camo Green', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Digital_Camo_Green.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-digital-camo-green.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('f6db0b47-c16d-446d-8497-ef8449ba8070', 'Acid Drip', 'official', 'https://cdn.tewan.club/catalog/model-3/wraps/Official/Acid_Drip.png', 'https://cdn.tewan.club/previews/model-3/model-3-official-acid-drip.png', 'model-3', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('f8423fc5-0eba-4072-b931-b7bb04c165d1', 'Camo Stealth', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Camo_Stealth.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-camo-stealth.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('f8f815ed-712b-43da-bab4-adafb9ac676a', '红色底色，超燃火焰主题', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-3c89b87e-1769340925696.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'https://cdn.tewan.club/wraps/ai-generated/wrap-3c89b87e-1769340925696.png?x-oss-process=image/rotate,180/resize,w_1024,h_1024', 'model-y', false, '红色底色，超燃火焰主题', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('fd497e5d-83c8-407a-ad14-03b8827ad128', 'Gradient Green', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Gradient_Green.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-gradient-green.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('fd53418d-9747-4aab-9a81-8d95f79bc7cc', 'Camo Pink', 'official', 'https://cdn.tewan.club/catalog/cybertruck/wraps/Official/Camo_Pink.png', 'https://cdn.tewan.club/previews/cybertruck/cybertruck-official-camo-pink.png', 'cybertruck', true, NULL, NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            
            INSERT INTO wraps (id, name, category, texture_url, preview_url, model_slug, is_public, prompt, description, user_id, created_at, updated_at)
            VALUES ('fd6da9e9-91c6-40e2-9419-d763a771d808', '消防车', 'ai_generated', 'https://cdn.tewan.club/wraps/ai-generated/wrap-b4734aa5-1769239819236.png', 'https://cdn.tewan.club/wraps/ai-generated/wrap-b4734aa5-1769239819236.png', 'cybertruck', false, '消防车', NULL, NULL, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET 
                name = EXCLUDED.name,
                texture_url = EXCLUDED.texture_url,
                preview_url = EXCLUDED.preview_url,
                is_public = EXCLUDED.is_public;
            COMMIT;
