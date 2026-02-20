CREATE TABLE IF NOT EXISTS "requests" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "method" TEXT,
  "path" TEXT,
  "status_code" REAL,
  "duration_ms" REAL,
  "ip_address" TEXT,
  "memory_usage" REAL,
  "user_agent" TEXT,
  "error_message" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "deleted_at" TEXT
);