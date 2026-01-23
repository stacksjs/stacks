CREATE TABLE IF NOT EXISTS "products" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "description" TEXT,
  "price" REAL,
  "image_url" TEXT,
  "is_available" INTEGER,
  "inventory_count" REAL,
  "preparation_time" REAL,
  "allergens" TEXT,
  "nutritional_info" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);