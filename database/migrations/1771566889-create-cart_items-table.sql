CREATE TABLE IF NOT EXISTS "cart_items" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "quantity" REAL,
  "unit_price" REAL,
  "total_price" REAL,
  "tax_rate" REAL,
  "tax_amount" REAL,
  "discount_percentage" REAL,
  "discount_amount" REAL,
  "product_name" TEXT,
  "product_sku" TEXT,
  "product_image" TEXT,
  "notes" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT,
  "cart_id" INTEGER REFERENCES "carts"("id")
);