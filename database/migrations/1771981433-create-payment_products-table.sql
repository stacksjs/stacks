CREATE TABLE IF NOT EXISTS "payment_products" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "description" TEXT,
  "key" TEXT,
  "unit_price" REAL,
  "status" TEXT,
  "image" TEXT,
  "provider_id" TEXT
);