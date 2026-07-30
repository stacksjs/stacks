PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_license_keys" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "key" TEXT not null,
  "template" TEXT CHECK ("template" IN ('Standard License', 'Premium License', 'Enterprise License')) not null,
  "expiry_date" TEXT not null,
  "status" TEXT CHECK ("status" IN ('active', 'inactive', 'unassigned')) default 'unassigned',
  "customer_id" INTEGER REFERENCES "customers"("id"),
  "product_id" INTEGER REFERENCES "products"("id"),
  "order_id" INTEGER REFERENCES "orders"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_license_keys" ("id", "key", "template", "expiry_date", "status", "customer_id", "product_id", "order_id", "created_at", "updated_at", "uuid") SELECT "id", "key", "template", "expiry_date", "status", "customer_id", "product_id", "order_id", "created_at", "updated_at", "uuid" FROM "license_keys";
DROP TABLE "license_keys";
ALTER TABLE "_qb_tmp_license_keys" RENAME TO "license_keys";
CREATE UNIQUE INDEX IF NOT EXISTS "license_keys_license_keys_key_unique" ON "license_keys" ("key");
CREATE UNIQUE INDEX IF NOT EXISTS "license_keys_license_keys_uuid_unique" ON "license_keys" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
