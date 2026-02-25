CREATE TABLE IF NOT EXISTS "shipping_zones" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "countries" TEXT,
  "regions" TEXT,
  "postal_codes" TEXT,
  "status" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);