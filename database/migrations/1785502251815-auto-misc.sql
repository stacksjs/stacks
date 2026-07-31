PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_coupons" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "code" TEXT not null,
  "description" TEXT,
  "status" TEXT CHECK ("status" IN ('Active', 'Scheduled', 'Expired')) not null default 'Active',
  "is_active" INTEGER not null default 1,
  "discount_type" TEXT CHECK ("discount_type" IN ('fixed_amount', 'percentage')) not null,
  "discount_value" INTEGER not null,
  "min_order_amount" INTEGER,
  "max_discount_amount" INTEGER,
  "free_product_id" TEXT,
  "usage_limit" INTEGER,
  "usage_count" INTEGER default 0,
  "start_date" TEXT,
  "end_date" TEXT,
  "product_id" INTEGER REFERENCES "products"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_coupons" ("id", "code", "description", "status", "is_active", "discount_type", "discount_value", "min_order_amount", "max_discount_amount", "free_product_id", "usage_limit", "usage_count", "start_date", "end_date", "product_id", "created_at", "updated_at", "uuid") SELECT "id", "code", "description", "status", "is_active", "discount_type", "discount_value", "min_order_amount", "max_discount_amount", "free_product_id", "usage_limit", "usage_count", "start_date", "end_date", "product_id", "created_at", "updated_at", "uuid" FROM "coupons";
DROP TABLE "coupons";
ALTER TABLE "_qb_tmp_coupons" RENAME TO "coupons";
CREATE UNIQUE INDEX IF NOT EXISTS "coupons_code_unique" ON "coupons" ("code");
CREATE UNIQUE INDEX IF NOT EXISTS "coupons_uuid_unique" ON "coupons" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_customers" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT not null,
  "email" TEXT not null,
  "phone" TEXT,
  "total_spent" INTEGER default 0,
  "last_order" TEXT,
  "status" TEXT CHECK ("status" IN ('Active', 'Inactive')) not null default 'Active',
  "avatar" TEXT not null,
  "user_id" INTEGER REFERENCES "users"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_customers" ("id", "name", "email", "phone", "total_spent", "last_order", "status", "avatar", "user_id", "created_at", "updated_at", "uuid") SELECT "id", "name", "email", "phone", "total_spent", "last_order", "status", "avatar", "user_id", "created_at", "updated_at", "uuid" FROM "customers";
DROP TABLE "customers";
ALTER TABLE "_qb_tmp_customers" RENAME TO "customers";
CREATE UNIQUE INDEX IF NOT EXISTS "customers_email_unique" ON "customers" ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "customers_uuid_unique" ON "customers" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_gift_cards" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "code" TEXT not null,
  "initial_balance" INTEGER not null,
  "current_balance" INTEGER not null,
  "currency" TEXT not null default 'USD',
  "status" TEXT CHECK ("status" IN ('ACTIVE', 'USED', 'EXPIRED', 'DEACTIVATED')) not null,
  "purchaser_id" TEXT,
  "recipient_email" TEXT,
  "recipient_name" TEXT,
  "personal_message" TEXT,
  "is_digital" INTEGER default 0,
  "is_reloadable" INTEGER default 0,
  "is_active" INTEGER default 1,
  "expiry_date" TEXT,
  "last_used_date" TEXT,
  "template_id" TEXT,
  "customer_id" INTEGER REFERENCES "customers"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_gift_cards" ("id", "code", "initial_balance", "current_balance", "currency", "status", "purchaser_id", "recipient_email", "recipient_name", "personal_message", "is_digital", "is_reloadable", "is_active", "expiry_date", "last_used_date", "template_id", "customer_id", "created_at", "updated_at", "uuid") SELECT "id", "code", "initial_balance", "current_balance", "currency", "status", "purchaser_id", "recipient_email", "recipient_name", "personal_message", "is_digital", "is_reloadable", "is_active", "expiry_date", "last_used_date", "template_id", "customer_id", "created_at", "updated_at", "uuid" FROM "gift_cards";
DROP TABLE "gift_cards";
ALTER TABLE "_qb_tmp_gift_cards" RENAME TO "gift_cards";
CREATE UNIQUE INDEX IF NOT EXISTS "gift_cards_code_unique" ON "gift_cards" ("code");
CREATE UNIQUE INDEX IF NOT EXISTS "gift_cards_uuid_unique" ON "gift_cards" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_manufacturers" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "manufacturer" TEXT not null,
  "description" TEXT,
  "country" TEXT not null,
  "featured" INTEGER default 0,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_manufacturers" ("id", "manufacturer", "description", "country", "featured", "created_at", "updated_at", "uuid") SELECT "id", "manufacturer", "description", "country", "featured", "created_at", "updated_at", "uuid" FROM "manufacturers";
DROP TABLE "manufacturers";
ALTER TABLE "_qb_tmp_manufacturers" RENAME TO "manufacturers";
CREATE UNIQUE INDEX IF NOT EXISTS "manufacturers_manufacturer_unique" ON "manufacturers" ("manufacturer");
CREATE UNIQUE INDEX IF NOT EXISTS "manufacturers_uuid_unique" ON "manufacturers" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_orders" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "status" TEXT not null,
  "total_amount" INTEGER not null,
  "currency" TEXT not null default 'USD',
  "tax_amount" INTEGER default 0,
  "discount_amount" INTEGER default 0,
  "delivery_fee" INTEGER default 0,
  "tip_amount" INTEGER default 0,
  "order_type" TEXT not null,
  "delivery_address" TEXT,
  "special_instructions" TEXT,
  "estimated_delivery_time" TEXT,
  "applied_coupon_id" TEXT,
  "customer_id" INTEGER REFERENCES "customers"("id"),
  "coupon_id" INTEGER REFERENCES "coupons"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_orders" ("id", "status", "total_amount", "currency", "tax_amount", "discount_amount", "delivery_fee", "tip_amount", "order_type", "delivery_address", "special_instructions", "estimated_delivery_time", "applied_coupon_id", "customer_id", "coupon_id", "created_at", "updated_at", "uuid") SELECT "id", "status", "total_amount", "currency", "tax_amount", "discount_amount", "delivery_fee", "tip_amount", "order_type", "delivery_address", "special_instructions", "estimated_delivery_time", "applied_coupon_id", "customer_id", "coupon_id", "created_at", "updated_at", "uuid" FROM "orders";
DROP TABLE "orders";
ALTER TABLE "_qb_tmp_orders" RENAME TO "orders";
CREATE UNIQUE INDEX IF NOT EXISTS "orders_uuid_unique" ON "orders" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_payments" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "amount" INTEGER not null,
  "method" TEXT CHECK ("method" IN ('cash', 'creditCard', 'debitCard', 'paypal', 'applePay', 'googlePay', 'bankTransfer', 'giftCard')) not null,
  "status" TEXT CHECK ("status" IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'partiallyRefunded', 'succeeded')) not null default 'pending',
  "currency" TEXT not null default 'USD',
  "reference_number" TEXT,
  "card_last_four" TEXT,
  "card_brand" TEXT,
  "billing_email" TEXT,
  "transaction_id" TEXT,
  "payment_provider" TEXT,
  "refund_amount" INTEGER default 0,
  "notes" TEXT,
  "order_id" INTEGER REFERENCES "orders"("id"),
  "customer_id" INTEGER REFERENCES "customers"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_payments" ("id", "amount", "method", "status", "currency", "reference_number", "card_last_four", "card_brand", "billing_email", "transaction_id", "payment_provider", "refund_amount", "notes", "order_id", "customer_id", "created_at", "updated_at", "uuid") SELECT "id", "amount", "method", "status", "currency", "reference_number", "card_last_four", "card_brand", "billing_email", "transaction_id", "payment_provider", "refund_amount", "notes", "order_id", "customer_id", "created_at", "updated_at", "uuid" FROM "payments";
DROP TABLE "payments";
ALTER TABLE "_qb_tmp_payments" RENAME TO "payments";
CREATE UNIQUE INDEX IF NOT EXISTS "payments_transaction_id_unique" ON "payments" ("transaction_id");
CREATE UNIQUE INDEX IF NOT EXISTS "payments_uuid_unique" ON "payments" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_product_units" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT not null,
  "abbreviation" TEXT not null,
  "type" TEXT not null,
  "description" TEXT,
  "is_default" INTEGER default 0,
  "product_id" INTEGER REFERENCES "products"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_product_units" ("id", "name", "abbreviation", "type", "description", "is_default", "product_id", "created_at", "updated_at", "uuid") SELECT "id", "name", "abbreviation", "type", "description", "is_default", "product_id", "created_at", "updated_at", "uuid" FROM "product_units";
DROP TABLE "product_units";
ALTER TABLE "_qb_tmp_product_units" RENAME TO "product_units";
CREATE UNIQUE INDEX IF NOT EXISTS "product_units_uuid_unique" ON "product_units" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_receipts" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "printer" TEXT,
  "document" TEXT not null,
  "timestamp" TEXT not null,
  "status" TEXT CHECK ("status" IN ('success', 'failed', 'warning')) not null,
  "size" INTEGER default 0,
  "pages" INTEGER default 0,
  "duration" INTEGER default 0,
  "metadata" TEXT default '{}',
  "print_device_id" INTEGER REFERENCES "print_devices"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_receipts" ("id", "printer", "document", "timestamp", "status", "size", "pages", "duration", "metadata", "print_device_id", "created_at", "updated_at", "uuid") SELECT "id", "printer", "document", "timestamp", "status", "size", "pages", "duration", "metadata", "print_device_id", "created_at", "updated_at", "uuid" FROM "receipts";
DROP TABLE "receipts";
ALTER TABLE "_qb_tmp_receipts" RENAME TO "receipts";
CREATE UNIQUE INDEX IF NOT EXISTS "receipts_uuid_unique" ON "receipts" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_reviews" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "rating" INTEGER not null,
  "title" TEXT,
  "content" TEXT,
  "is_verified_purchase" INTEGER default 0,
  "is_approved" INTEGER default 0,
  "is_featured" INTEGER default 0,
  "helpful_votes" INTEGER default 0,
  "unhelpful_votes" INTEGER default 0,
  "purchase_date" TEXT,
  "images" TEXT,
  "product_id" INTEGER REFERENCES "products"("id"),
  "customer_id" INTEGER REFERENCES "customers"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_reviews" ("id", "rating", "title", "content", "is_verified_purchase", "is_approved", "is_featured", "helpful_votes", "unhelpful_votes", "purchase_date", "images", "product_id", "customer_id", "created_at", "updated_at", "uuid") SELECT "id", "rating", "title", "content", "is_verified_purchase", "is_approved", "is_featured", "helpful_votes", "unhelpful_votes", "purchase_date", "images", "product_id", "customer_id", "created_at", "updated_at", "uuid" FROM "reviews";
DROP TABLE "reviews";
ALTER TABLE "_qb_tmp_reviews" RENAME TO "reviews";
CREATE UNIQUE INDEX IF NOT EXISTS "reviews_uuid_unique" ON "reviews" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
