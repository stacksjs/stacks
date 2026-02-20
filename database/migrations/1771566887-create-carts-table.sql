CREATE TABLE IF NOT EXISTS "carts" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "status" TEXT default 'active',
  "total_items" REAL default 0,
  "subtotal" REAL default 0,
  "tax_amount" REAL default 0,
  "discount_amount" REAL default 0,
  "total" REAL default 0,
  "expires_at" TEXT,
  "currency" TEXT default 'USD',
  "notes" TEXT,
  "applied_coupon_id" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT,
  "customer_id" INTEGER REFERENCES "customers"("id"),
  "coupon_id" INTEGER REFERENCES "coupons"("id")
);