CREATE TABLE IF NOT EXISTS "errors" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "type" TEXT,
  "message" TEXT,
  "stack" TEXT,
  "status" REAL,
  "additional_info" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);