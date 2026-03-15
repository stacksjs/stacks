CREATE TABLE IF NOT EXISTS "requests" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "method" TEXT CHECK ("method" IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD')),
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