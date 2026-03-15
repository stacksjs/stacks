CREATE TABLE IF NOT EXISTS "coupons" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "code" TEXT,
  "description" TEXT,
  "status" TEXT CHECK ("status" IN ('Active', 'Scheduled', 'Expired')),
  "is_active" INTEGER,
  "discount_type" TEXT CHECK ("discount_type" IN ('fixed_amount', 'percentage')),
  "discount_value" REAL,
  "min_order_amount" REAL,
  "max_discount_amount" REAL,
  "free_product_id" TEXT,
  "usage_limit" REAL,
  "usage_count" REAL,
  "start_date" TEXT,
  "end_date" TEXT,
  "product_id" INTEGER,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);