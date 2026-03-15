CREATE TABLE IF NOT EXISTS "logs" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "timestamp" REAL,
  "type" TEXT CHECK ("type" IN ('warning', 'error', 'info', 'success')),
  "source" TEXT CHECK ("source" IN ('file', 'cli', 'system')),
  "message" TEXT,
  "project" TEXT,
  "stacktrace" TEXT,
  "file" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);