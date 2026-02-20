-- ============================================
-- Bot Creator 功能迁移
-- 1. 新增 bot_creator 角色
-- 2. 新增 bot_topic_candidates 选题表
-- ============================================

-- 1. 扩展 user_role 枚举，新增 bot_creator
-- PostgreSQL 枚举只能新增，不能删除
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'bot_creator';

-- 2. 选题候选表
CREATE TABLE IF NOT EXISTS bot_topic_candidates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_name      TEXT NOT NULL,                          -- 选题名称，如"液态银极简风"
    color_keyword   TEXT,                                   -- 颜色关键词，如"液态银"
    style_keyword   TEXT,                                   -- 风格关键词，如"极简哑光"
    model_slug      TEXT NOT NULL DEFAULT 'model-3',        -- 车型，如 model-3 / model-y / cybertruck
    virtual_user_id UUID REFERENCES users(id),              -- 指定哪个虚拟账号来创作
    trend_score     INTEGER DEFAULT 0,                      -- 热度分值（爬取时评估）
    source_url      TEXT,                                   -- 来源链接（小红书帖子等）
    suggested_prompt TEXT,                                  -- 给 Gemini 的建议 prompt
    status          TEXT NOT NULL DEFAULT 'pending'         -- pending / approved / rejected / generating / generated / failed
                    CHECK (status IN ('pending','approved','rejected','generating','generated','failed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at     TIMESTAMPTZ,
    approved_by     UUID REFERENCES users(id),
    wrap_id         UUID REFERENCES wraps(id),              -- 生成成功后关联的 wrap
    failure_reason  TEXT,
    batch_date      DATE NOT NULL DEFAULT CURRENT_DATE      -- 哪天的选题批次
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_bot_topics_status ON bot_topic_candidates(status);
CREATE INDEX IF NOT EXISTS idx_bot_topics_batch_date ON bot_topic_candidates(batch_date DESC);
CREATE INDEX IF NOT EXISTS idx_bot_topics_virtual_user ON bot_topic_candidates(virtual_user_id);

-- 3. Bot 账号配置表（固定 5 个虚拟账号的元信息）
CREATE TABLE IF NOT EXISTS bot_virtual_users (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    persona_name    TEXT NOT NULL,      -- 对外昵称，如"极简林同学"
    persona_key     TEXT NOT NULL UNIQUE, -- 代码中标识，如 bot_minimalist
    style_focus     TEXT,               -- 风格定位描述
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Bot 生成汇总统计视图（供 Admin 面板直接查询）
CREATE OR REPLACE VIEW bot_daily_stats AS
SELECT
    btc.batch_date,
    bvu.persona_name,
    bvu.persona_key,
    COUNT(*) FILTER (WHERE btc.status = 'generated') AS generated_count,
    COUNT(*) FILTER (WHERE btc.status = 'failed')    AS failed_count,
    COUNT(*) FILTER (WHERE btc.status = 'pending')   AS pending_count,
    COUNT(*) FILTER (WHERE btc.status = 'approved')  AS approved_count,
    COALESCE(SUM(w.download_count), 0)               AS total_downloads
FROM bot_topic_candidates btc
LEFT JOIN bot_virtual_users bvu ON bvu.user_id = btc.virtual_user_id
LEFT JOIN wraps w ON w.id = btc.wrap_id
GROUP BY btc.batch_date, bvu.persona_name, bvu.persona_key
ORDER BY btc.batch_date DESC, bvu.persona_key;

COMMENT ON TABLE bot_topic_candidates IS 'AI 创作机器人每日选题候选，需管理员批准后才触发生成';
COMMENT ON TABLE bot_virtual_users IS 'Bot 虚拟账号元信息注册表，对应 users 表中的真实用户';
