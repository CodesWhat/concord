CREATE TABLE audit_log (
  id BIGINT PRIMARY KEY,
  server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  action VARCHAR(64) NOT NULL,
  target_type VARCHAR(32),
  target_id TEXT,
  changes JSONB DEFAULT '{}',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_log_server ON audit_log(server_id, id DESC);
CREATE INDEX idx_audit_log_actor ON audit_log(server_id, actor_id);
CREATE INDEX idx_audit_log_action ON audit_log(server_id, action);
