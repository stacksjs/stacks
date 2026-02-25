CREATE TABLE IF NOT EXISTS "orders" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "status" TEXT,
  "total_amount" REAL,
  "tax_amount" REAL,
  "discount_amount" REAL,
  "delivery_fee" REAL,
  "tip_amount" REAL,
  "order_type" TEXT,
  "delivery_address" TEXT,
  "special_instructions" TEXT,
  "estimated_delivery_time" TEXT,
  "applied_coupon_id" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);