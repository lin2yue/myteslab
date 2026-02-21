-- Credit rules and download milestone rewards

CREATE TABLE IF NOT EXISTS credit_reward_rules (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  registration_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  registration_credits INTEGER NOT NULL DEFAULT 30 CHECK (registration_credits >= 0),
  download_reward_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  download_threshold INTEGER NOT NULL DEFAULT 100 CHECK (download_threshold >= 1),
  download_reward_credits INTEGER NOT NULL DEFAULT 10 CHECK (download_reward_credits >= 0),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO credit_reward_rules (
  id,
  registration_enabled,
  registration_credits,
  download_reward_enabled,
  download_threshold,
  download_reward_credits
)
VALUES (1, TRUE, 30, FALSE, 100, 10)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS wrap_download_reward_grants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wrap_id UUID NOT NULL REFERENCES wraps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  milestone_downloads INTEGER NOT NULL CHECK (milestone_downloads >= 1),
  reward_credits INTEGER NOT NULL CHECK (reward_credits >= 0),
  ledger_id UUID REFERENCES credit_ledger(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (wrap_id, milestone_downloads)
);

CREATE INDEX IF NOT EXISTS idx_wrap_download_reward_grants_user_created
  ON wrap_download_reward_grants(user_id, created_at DESC);
