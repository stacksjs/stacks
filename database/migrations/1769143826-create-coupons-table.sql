CREATE TABLE IF NOT EXISTS "coupons" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "code" TEXT,
  "description" TEXT,
  "status" TEXT,
  "is_active" INTEGER,
  "discount_type" TEXT,
  "discount_value" REAL,
  "min_order_amount" REAL,
  "max_discount_amount" REAL,
  "free_product_id" TEXT,
  "product_id" INTEGER,
  "usage_limit" REAL,
  "usage_count" REAL,
  "start_date" TEXT,
  "end_date" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);