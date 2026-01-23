CREATE TABLE IF NOT EXISTS "failed_jobs" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "connection" TEXT,
  "queue" TEXT,
  "payload" TEXT,
  "exception" TEXT,
  "failed_at" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);