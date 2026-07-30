PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_receipts" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "printer" TEXT,
  "document" TEXT not null,
  "timestamp" TEXT not null,
  "status" TEXT CHECK ("status" IN ('success', 'failed', 'warning')) not null,
  "size" INTEGER,
  "pages" INTEGER,
  "duration" INTEGER,
  "metadata" TEXT default '{}',
  "print_device_id" INTEGER REFERENCES "print_devices"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_receipts" ("id", "printer", "document", "timestamp", "status", "size", "pages", "duration", "metadata", "print_device_id", "created_at", "updated_at", "uuid") SELECT "id", "printer", "document", "timestamp", "status", "size", "pages", "duration", "metadata", "print_device_id", "created_at", "updated_at", "uuid" FROM "receipts";
DROP TABLE "receipts";
ALTER TABLE "_qb_tmp_receipts" RENAME TO "receipts";
CREATE UNIQUE INDEX IF NOT EXISTS "receipts_receipts_uuid_unique" ON "receipts" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_coupons" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "code" TEXT not null,
  "description" TEXT,
  "status" TEXT CHECK ("status" IN ('Active', 'Scheduled', 'Expired')),
  "is_active" INTEGER not null default 1,
  "discount_type" TEXT CHECK ("discount_type" IN ('fixed_amount', 'percentage')) not null,
  "discount_value" INTEGER not null,
  "min_order_amount" INTEGER,
  "max_discount_amount" INTEGER,
  "free_product_id" TEXT,
  "usage_limit" INTEGER,
  "usage_count" INTEGER,
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
CREATE UNIQUE INDEX IF NOT EXISTS "coupons_coupons_code_unique" ON "coupons" ("code");
CREATE UNIQUE INDEX IF NOT EXISTS "coupons_coupons_uuid_unique" ON "coupons" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
