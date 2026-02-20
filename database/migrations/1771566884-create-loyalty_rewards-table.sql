CREATE TABLE IF NOT EXISTS "loyalty_rewards" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "description" TEXT,
  "points_required" REAL,
  "reward_type" TEXT,
  "discount_percentage" REAL,
  "free_product_id" TEXT,
  "is_active" INTEGER,
  "expiry_days" REAL,
  "image_url" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT,
  "product_id" INTEGER REFERENCES "products"("id")
);