CREATE TABLE IF NOT EXISTS "print_devices" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "mac_address" TEXT,
  "location" TEXT,
  "terminal" TEXT,
  "status" TEXT,
  "last_ping" TEXT,
  "print_count" REAL,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);