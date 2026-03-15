CREATE TABLE IF NOT EXISTS "shipping_methods" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "description" TEXT,
  "base_rate" REAL,
  "free_shipping" REAL,
  "status" TEXT CHECK ("status" IN ('active', 'inactive', 'draft')),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);