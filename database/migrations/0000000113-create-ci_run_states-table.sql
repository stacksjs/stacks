CREATE TABLE IF NOT EXISTS ci_run_states (
  repo_full_name TEXT PRIMARY KEY,
  last_conclusion TEXT,
  last_run_id INTEGER,
  last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_notified_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ci_run_states_last_notified_index ON ci_run_states(last_notified_at);
