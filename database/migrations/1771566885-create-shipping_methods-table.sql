CREATE TABLE IF NOT EXISTS "shipping_methods" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "description" TEXT,
  "base_rate" REAL,
  "free_shipping" REAL,
  "status" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);