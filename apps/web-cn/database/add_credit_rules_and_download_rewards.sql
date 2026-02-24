-- Credit rules and download milestone rewards

CREATE TABLE IF NOT EXISTS credit_reward_rules (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  registration_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  registration_credits INTEGER NOT NULL DEFAULT 30 CHECK (registration_credits >= 0),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

INSERT INTO credit_reward_rules (
  id,
  registration_enabled,
  registration_credits
)
VALUES (1, TRUE, 30)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS credit_reward_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'ended')),
  start_at TIMESTAMP WITH TIME ZONE NOT NULL,
  end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  milestones JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CHECK (end_at > start_at)
);

CREATE TABLE IF NOT EXISTS credit_reward_campaign_grants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES credit_reward_campaigns(id) ON DELETE CASCADE,
  wrap_id UUID NOT NULL REFERENCES wraps(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  milestone_downloads INTEGER NOT NULL CHECK (milestone_downloads >= 1),
  metric_value INTEGER NOT NULL CHECK (metric_value >= 0),
  reward_credits INTEGER NOT NULL CHECK (reward_credits >= 0),
  ledger_id UUID REFERENCES credit_ledger(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, wrap_id, milestone_downloads)
);

CREATE INDEX IF NOT EXISTS idx_credit_reward_campaigns_status_window
  ON credit_reward_campaigns(status, start_at, end_at);

CREATE INDEX IF NOT EXISTS idx_credit_reward_campaign_grants_campaign_created
  ON credit_reward_campaign_grants(campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_reward_campaign_grants_user_created
  ON credit_reward_campaign_grants(user_id, created_at DESC);
