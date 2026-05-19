CREATE TABLE IF NOT EXISTS ci_runner_alert_states (
  org TEXT PRIMARY KEY,
  alerting INTEGER NOT NULL DEFAULT 0,
  last_alerted_at DATETIME,
  last_cleared_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
