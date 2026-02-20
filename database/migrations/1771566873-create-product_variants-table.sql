CREATE TABLE IF NOT EXISTS "product_variants" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "variant" TEXT,
  "type" TEXT,
  "description" TEXT,
  "options" TEXT,
  "status" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT,
  "product_id" INTEGER REFERENCES "products"("id")
);