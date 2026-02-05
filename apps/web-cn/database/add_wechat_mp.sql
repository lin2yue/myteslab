-- ============================================
-- WeChat Scan-to-Follow (MP) Support
-- ============================================

-- 为 user_identities 增加 OpenID (公众号) 支持
-- 方案：复用 provider = 'wechat'，但通过字段区分不同平台的 OpenID
ALTER TABLE user_identities ADD COLUMN IF NOT EXISTS openid_mp TEXT;

-- 微信公众号扫码登录会话表
CREATE TABLE IF NOT EXISTS wechat_qr_sessions (
  scene_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, COMPLETED, EXPIRED
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_wechat_qr_sessions_ticket ON wechat_qr_sessions(ticket);
