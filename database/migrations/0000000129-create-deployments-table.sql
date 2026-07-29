CREATE TABLE IF NOT EXISTS "deployments" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "commit_hash" TEXT not null,
  "commit_message" TEXT,
  "branch" TEXT not null,
  "status" TEXT not null,
  "environment" TEXT not null,
  "duration" INTEGER,
  "author" TEXT not null,
  "url" TEXT,
  "error_log" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "deployments_deployments_uuid_unique" ON "deployments" ("uuid");
