CREATE TABLE IF NOT EXISTS "digital_deliveries" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "description" TEXT,
  "download_limit" REAL,
  "expiry_days" REAL,
  "requires_login" INTEGER default 0,
  "automatic_delivery" INTEGER default 0,
  "status" TEXT default 'active',
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);