CREATE TABLE IF NOT EXISTS ci_runner_samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org TEXT NOT NULL,
  running INTEGER NOT NULL DEFAULT 0,
  queued INTEGER NOT NULL DEFAULT 0,
  cap INTEGER NOT NULL DEFAULT 0,
  sampled_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ci_runner_samples_org_sampled_index ON ci_runner_samples(org, sampled_at);
CREATE INDEX IF NOT EXISTS ci_runner_samples_sampled_index ON ci_runner_samples(sampled_at);
