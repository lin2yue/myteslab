-- 百度主动推送日志表（用于审计与排障）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS baidu_push_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source VARCHAR(64) NOT NULL DEFAULT 'unknown',
  site_host TEXT NOT NULL,
  request_url_count INTEGER NOT NULL DEFAULT 0 CHECK (request_url_count >= 0),
  request_url_sample TEXT[] NOT NULL DEFAULT '{}',
  valid_url_count INTEGER NOT NULL DEFAULT 0 CHECK (valid_url_count >= 0),
  status VARCHAR(16) NOT NULL CHECK (status IN ('success', 'error', 'skipped')),
  http_status INTEGER,
  baidu_success INTEGER NOT NULL DEFAULT 0,
  baidu_remain INTEGER,
  baidu_error INTEGER,
  baidu_message TEXT,
  not_same_site TEXT[] NOT NULL DEFAULT '{}',
  not_valid TEXT[] NOT NULL DEFAULT '{}',
  duration_ms INTEGER NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  response_payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_baidu_push_logs_created_at ON baidu_push_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_baidu_push_logs_source_created_at ON baidu_push_logs(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_baidu_push_logs_status_created_at ON baidu_push_logs(status, created_at DESC);
