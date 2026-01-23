CREATE TABLE IF NOT EXISTS "license_keys" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "key" TEXT,
  "template" TEXT,
  "expiry_date" TEXT,
  "status" TEXT default 'unassigned',
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);