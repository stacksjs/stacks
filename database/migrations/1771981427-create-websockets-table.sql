CREATE TABLE IF NOT EXISTS "websockets" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "type" TEXT,
  "socket" TEXT,
  "details" TEXT,
  "time" REAL,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);