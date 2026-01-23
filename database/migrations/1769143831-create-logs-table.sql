CREATE TABLE IF NOT EXISTS "logs" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "timestamp" REAL,
  "type" TEXT,
  "source" TEXT,
  "message" TEXT,
  "project" TEXT,
  "stacktrace" TEXT,
  "file" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);