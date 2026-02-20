CREATE TYPE automod_rule_type AS ENUM ('word_filter', 'link_filter', 'spam', 'raid');
CREATE TABLE automod_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  type automod_rule_type NOT NULL,
  name VARCHAR(100) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}',
  action VARCHAR(32) NOT NULL DEFAULT 'delete',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_automod_rules_server ON automod_rules(server_id);
