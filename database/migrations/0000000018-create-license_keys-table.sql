CREATE TABLE IF NOT EXISTS "license_keys" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "key" TEXT,
  "template" TEXT CHECK ("template" IN ('Standard License', 'Premium License', 'Enterprise License')),
  "expiry_date" TEXT,
  "status" TEXT CHECK ("status" IN ('active', 'inactive', 'unassigned')) default 'unassigned',
  "customer_id" INTEGER,
  "product_id" INTEGER,
  "order_id" INTEGER,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);