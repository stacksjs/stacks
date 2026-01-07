CREATE TABLE IF NOT EXISTS "deployments" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "commit_sha" TEXT,
  "commit_message" TEXT,
  "branch" TEXT,
  "status" TEXT,
  "execution_time" REAL,
  "deploy_script" TEXT,
  "terminal_output" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);