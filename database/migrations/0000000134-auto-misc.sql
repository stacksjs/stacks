PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_print_devices" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT not null,
  "mac_address" TEXT not null,
  "location" TEXT not null,
  "terminal" TEXT not null,
  "status" TEXT CHECK ("status" IN ('online', 'offline', 'warning')) not null,
  "last_ping" TEXT not null,
  "print_count" INTEGER not null,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_print_devices" ("id", "name", "mac_address", "location", "terminal", "status", "last_ping", "print_count", "created_at", "updated_at", "uuid") SELECT "id", "name", "mac_address", "location", "terminal", "status", "last_ping", "print_count", "created_at", "updated_at", "uuid" FROM "print_devices";
DROP TABLE "print_devices";
ALTER TABLE "_qb_tmp_print_devices" RENAME TO "print_devices";
CREATE UNIQUE INDEX IF NOT EXISTS "print_devices_print_devices_uuid_unique" ON "print_devices" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_websockets" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "type" TEXT CHECK ("type" IN ('disconnection', 'error', 'success')) not null,
  "socket" TEXT not null,
  "details" TEXT not null,
  "time" INTEGER not null,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
INSERT INTO "_qb_tmp_websockets" ("id", "type", "socket", "details", "time", "created_at", "updated_at") SELECT "id", "type", "socket", "details", "time", "created_at", "updated_at" FROM "websockets";
DROP TABLE "websockets";
ALTER TABLE "_qb_tmp_websockets" RENAME TO "websockets";
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_tags" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT not null,
  "slug" TEXT not null,
  "description" TEXT,
  "post_count" INTEGER default 0,
  "color" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_tags" ("id", "name", "slug", "description", "post_count", "color", "created_at", "updated_at", "uuid") SELECT "id", "name", "slug", "description", "post_count", "color", "created_at", "updated_at", "uuid" FROM "tags";
DROP TABLE "tags";
ALTER TABLE "_qb_tmp_tags" RENAME TO "tags";
CREATE UNIQUE INDEX IF NOT EXISTS "tags_tags_name_unique" ON "tags" ("name");
CREATE UNIQUE INDEX IF NOT EXISTS "tags_tags_slug_unique" ON "tags" ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "tags_tags_uuid_unique" ON "tags" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_categories" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT not null,
  "description" TEXT,
  "slug" TEXT not null,
  "image_url" TEXT,
  "is_active" INTEGER,
  "parent_category_id" TEXT,
  "display_order" INTEGER not null,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_categories" ("id", "name", "description", "slug", "image_url", "is_active", "parent_category_id", "display_order", "created_at", "updated_at", "uuid") SELECT "id", "name", "description", "slug", "image_url", "is_active", "parent_category_id", "display_order", "created_at", "updated_at", "uuid" FROM "categories";
DROP TABLE "categories";
ALTER TABLE "_qb_tmp_categories" RENAME TO "categories";
CREATE UNIQUE INDEX IF NOT EXISTS "categories_categories_uuid_unique" ON "categories" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_payments" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "amount" INTEGER not null,
  "method" TEXT not null,
  "status" TEXT not null,
  "currency" TEXT,
  "reference_number" TEXT,
  "card_last_four" TEXT,
  "card_brand" TEXT,
  "billing_email" TEXT,
  "transaction_id" TEXT,
  "payment_provider" TEXT,
  "refund_amount" INTEGER,
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
CREATE UNIQUE INDEX IF NOT EXISTS "payments_payments_transaction_id_unique" ON "payments" ("transaction_id");
CREATE UNIQUE INDEX IF NOT EXISTS "payments_payments_uuid_unique" ON "payments" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_drivers" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT not null,
  "phone" TEXT not null,
  "vehicle_number" TEXT not null,
  "license" TEXT not null,
  "status" TEXT CHECK ("status" IN ('active', 'on_delivery', 'on_break')) default 'active',
  "user_id" INTEGER REFERENCES "users"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_drivers" ("id", "name", "phone", "vehicle_number", "license", "status", "user_id", "created_at", "updated_at", "uuid") SELECT "id", "name", "phone", "vehicle_number", "license", "status", "user_id", "created_at", "updated_at", "uuid" FROM "drivers";
DROP TABLE "drivers";
ALTER TABLE "_qb_tmp_drivers" RENAME TO "drivers";
CREATE UNIQUE INDEX IF NOT EXISTS "drivers_drivers_uuid_unique" ON "drivers" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_waitlist_products" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT not null,
  "email" TEXT not null,
  "phone" TEXT,
  "quantity" INTEGER not null,
  "notification_preference" TEXT CHECK ("notification_preference" IN ('sms', 'email', 'both')) not null,
  "source" TEXT not null,
  "notes" TEXT,
  "status" TEXT CHECK ("status" IN ('waiting', 'purchased', 'notified', 'cancelled')) not null default 'waiting',
  "notified_at" TEXT,
  "purchased_at" TEXT,
  "cancelled_at" TEXT,
  "product_id" INTEGER REFERENCES "products"("id"),
  "customer_id" INTEGER REFERENCES "customers"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_waitlist_products" ("id", "name", "email", "phone", "quantity", "notification_preference", "source", "notes", "status", "notified_at", "purchased_at", "cancelled_at", "product_id", "customer_id", "created_at", "updated_at", "uuid") SELECT "id", "name", "email", "phone", "quantity", "notification_preference", "source", "notes", "status", "notified_at", "purchased_at", "cancelled_at", "product_id", "customer_id", "created_at", "updated_at", "uuid" FROM "waitlist_products";
DROP TABLE "waitlist_products";
ALTER TABLE "_qb_tmp_waitlist_products" RENAME TO "waitlist_products";
CREATE UNIQUE INDEX IF NOT EXISTS "waitlist_products_waitlist_products_uuid_unique" ON "waitlist_products" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_digital_deliveries" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT not null,
  "description" TEXT not null,
  "download_limit" INTEGER,
  "expiry_days" INTEGER not null,
  "requires_login" INTEGER default 0,
  "automatic_delivery" INTEGER default 0,
  "status" TEXT CHECK ("status" IN ('active', 'inactive')) default 'active',
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_digital_deliveries" ("id", "name", "description", "download_limit", "expiry_days", "requires_login", "automatic_delivery", "status", "created_at", "updated_at", "uuid") SELECT "id", "name", "description", "download_limit", "expiry_days", "requires_login", "automatic_delivery", "status", "created_at", "updated_at", "uuid" FROM "digital_deliveries";
DROP TABLE "digital_deliveries";
ALTER TABLE "_qb_tmp_digital_deliveries" RENAME TO "digital_deliveries";
CREATE UNIQUE INDEX IF NOT EXISTS "digital_deliveries_digital_deliveries_uuid_unique" ON "digital_deliveries" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_payment_products" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT not null,
  "description" TEXT,
  "key" TEXT not null,
  "unit_price" INTEGER not null,
  "status" TEXT,
  "image" TEXT,
  "provider_id" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_payment_products" ("id", "name", "description", "key", "unit_price", "status", "image", "provider_id", "uuid") SELECT "id", "name", "description", "key", "unit_price", "status", "image", "provider_id", "uuid" FROM "payment_products";
DROP TABLE "payment_products";
ALTER TABLE "_qb_tmp_payment_products" RENAME TO "payment_products";
CREATE UNIQUE INDEX IF NOT EXISTS "payment_products_payment_products_uuid_unique" ON "payment_products" ("uuid");
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
  "featured" INTEGER,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_manufacturers" ("id", "manufacturer", "description", "country", "featured", "created_at", "updated_at", "uuid") SELECT "id", "manufacturer", "description", "country", "featured", "created_at", "updated_at", "uuid" FROM "manufacturers";
DROP TABLE "manufacturers";
ALTER TABLE "_qb_tmp_manufacturers" RENAME TO "manufacturers";
CREATE UNIQUE INDEX IF NOT EXISTS "manufacturers_manufacturers_manufacturer_unique" ON "manufacturers" ("manufacturer");
CREATE UNIQUE INDEX IF NOT EXISTS "manufacturers_manufacturers_uuid_unique" ON "manufacturers" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_order_items" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "quantity" INTEGER not null default 1,
  "price" INTEGER not null,
  "special_instructions" TEXT,
  "order_id" INTEGER REFERENCES "orders"("id"),
  "product_id" INTEGER REFERENCES "products"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
INSERT INTO "_qb_tmp_order_items" ("id", "quantity", "price", "special_instructions", "order_id", "product_id", "created_at", "updated_at") SELECT "id", "quantity", "price", "special_instructions", "order_id", "product_id", "created_at", "updated_at" FROM "order_items";
DROP TABLE "order_items";
ALTER TABLE "_qb_tmp_order_items" RENAME TO "order_items";
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_shipping_zones" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT not null,
  "countries" TEXT,
  "regions" TEXT,
  "postal_codes" TEXT,
  "status" TEXT CHECK ("status" IN ('active', 'inactive', 'draft')) not null,
  "shipping_method_id" INTEGER REFERENCES "shipping_methods"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_shipping_zones" ("id", "name", "countries", "regions", "postal_codes", "status", "shipping_method_id", "created_at", "updated_at", "uuid") SELECT "id", "name", "countries", "regions", "postal_codes", "status", "shipping_method_id", "created_at", "updated_at", "uuid" FROM "shipping_zones";
DROP TABLE "shipping_zones";
ALTER TABLE "_qb_tmp_shipping_zones" RENAME TO "shipping_zones";
CREATE UNIQUE INDEX IF NOT EXISTS "shipping_zones_shipping_zones_uuid_unique" ON "shipping_zones" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_failed_jobs" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "connection" TEXT not null,
  "queue" TEXT not null,
  "payload" TEXT not null,
  "exception" TEXT not null,
  "failed_at" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
INSERT INTO "_qb_tmp_failed_jobs" ("id", "connection", "queue", "payload", "exception", "failed_at", "created_at", "updated_at") SELECT "id", "connection", "queue", "payload", "exception", "failed_at", "created_at", "updated_at" FROM "failed_jobs";
DROP TABLE "failed_jobs";
ALTER TABLE "_qb_tmp_failed_jobs" RENAME TO "failed_jobs";
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_customers" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT not null,
  "email" TEXT not null,
  "phone" TEXT not null,
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
CREATE UNIQUE INDEX IF NOT EXISTS "customers_customers_email_unique" ON "customers" ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "customers_customers_uuid_unique" ON "customers" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_subscriber_emails" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "email" TEXT not null,
  "source" TEXT default 'homepage',
  "subscriber_id" INTEGER REFERENCES "subscribers"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_subscriber_emails" ("id", "email", "source", "subscriber_id", "created_at", "updated_at", "uuid") SELECT "id", "email", "source", "subscriber_id", "created_at", "updated_at", "uuid" FROM "subscriber_emails";
DROP TABLE "subscriber_emails";
ALTER TABLE "_qb_tmp_subscriber_emails" RENAME TO "subscriber_emails";
CREATE UNIQUE INDEX IF NOT EXISTS "subscriber_emails_subscriber_emails_uuid_unique" ON "subscriber_emails" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_products" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT not null,
  "description" TEXT,
  "price" INTEGER not null,
  "image_url" TEXT,
  "is_available" INTEGER,
  "inventory_count" INTEGER,
  "preparation_time" INTEGER not null,
  "allergens" TEXT,
  "nutritional_info" TEXT,
  "category_id" INTEGER REFERENCES "categories"("id"),
  "manufacturer_id" INTEGER REFERENCES "manufacturers"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_products" ("id", "name", "description", "price", "image_url", "is_available", "inventory_count", "preparation_time", "allergens", "nutritional_info", "category_id", "manufacturer_id", "created_at", "updated_at", "uuid") SELECT "id", "name", "description", "price", "image_url", "is_available", "inventory_count", "preparation_time", "allergens", "nutritional_info", "category_id", "manufacturer_id", "created_at", "updated_at", "uuid" FROM "products";
DROP TABLE "products";
ALTER TABLE "_qb_tmp_products" RENAME TO "products";
CREATE UNIQUE INDEX IF NOT EXISTS "products_products_uuid_unique" ON "products" ("uuid");
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
  "size" INTEGER,
  "pages" INTEGER,
  "duration" INTEGER,
  "metadata" TEXT,
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
CREATE TABLE "_qb_tmp_product_variants" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "variant" TEXT not null,
  "type" TEXT not null,
  "description" TEXT,
  "options" TEXT,
  "status" TEXT CHECK ("status" IN ('active', 'inactive', 'draft')) not null,
  "product_id" INTEGER REFERENCES "products"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_product_variants" ("id", "variant", "type", "description", "options", "status", "product_id", "created_at", "updated_at", "uuid") SELECT "id", "variant", "type", "description", "options", "status", "product_id", "created_at", "updated_at", "uuid" FROM "product_variants";
DROP TABLE "product_variants";
ALTER TABLE "_qb_tmp_product_variants" RENAME TO "product_variants";
CREATE UNIQUE INDEX IF NOT EXISTS "product_variants_product_variants_uuid_unique" ON "product_variants" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
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
CREATE UNIQUE INDEX IF NOT EXISTS "license_keys_license_keys_uuid_unique" ON "license_keys" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_labels" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "board_id" INTEGER not null REFERENCES "boards"("id"),
  "name" TEXT not null,
  "color" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_labels" ("id", "board_id", "name", "color", "created_at", "updated_at", "uuid") SELECT "id", "board_id", "name", "color", "created_at", "updated_at", "uuid" FROM "labels";
DROP TABLE "labels";
ALTER TABLE "_qb_tmp_labels" RENAME TO "labels";
CREATE UNIQUE INDEX IF NOT EXISTS "labels_labels_uuid_unique" ON "labels" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_payment_methods" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "type" TEXT not null,
  "last_four" INTEGER not null,
  "brand" TEXT not null,
  "exp_month" INTEGER not null,
  "exp_year" INTEGER not null,
  "is_default" INTEGER,
  "provider_id" TEXT,
  "user_id" INTEGER REFERENCES "users"("id"),
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_payment_methods" ("id", "type", "last_four", "brand", "exp_month", "exp_year", "is_default", "provider_id", "user_id", "uuid") SELECT "id", "type", "last_four", "brand", "exp_month", "exp_year", "is_default", "provider_id", "user_id", "uuid" FROM "payment_methods";
DROP TABLE "payment_methods";
ALTER TABLE "_qb_tmp_payment_methods" RENAME TO "payment_methods";
CREATE UNIQUE INDEX IF NOT EXISTS "payment_methods_payment_methods_uuid_unique" ON "payment_methods" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_board_columns" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "board_id" INTEGER not null REFERENCES "boards"("id"),
  "name" TEXT not null,
  "position" INTEGER,
  "card_limit" INTEGER,
  "color" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_board_columns" ("id", "board_id", "name", "position", "card_limit", "color", "created_at", "updated_at", "uuid") SELECT "id", "board_id", "name", "position", "card_limit", "color", "created_at", "updated_at", "uuid" FROM "board_columns";
DROP TABLE "board_columns";
ALTER TABLE "_qb_tmp_board_columns" RENAME TO "board_columns";
CREATE UNIQUE INDEX IF NOT EXISTS "board_columns_board_columns_uuid_unique" ON "board_columns" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_waitlist_restaurants" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT not null,
  "email" TEXT not null,
  "phone" TEXT,
  "party_size" INTEGER not null,
  "check_in_time" TEXT not null,
  "table_preference" TEXT CHECK ("table_preference" IN ('indoor', 'bar', 'booth', 'no_preference')) not null,
  "status" TEXT CHECK ("status" IN ('waiting', 'seated', 'cancelled', 'no_show')) not null default 'waiting',
  "quoted_wait_time" INTEGER not null,
  "actual_wait_time" INTEGER,
  "queue_position" INTEGER,
  "seated_at" TEXT,
  "no_show_at" TEXT,
  "cancelled_at" TEXT,
  "customer_id" INTEGER REFERENCES "customers"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_waitlist_restaurants" ("id", "name", "email", "phone", "party_size", "check_in_time", "table_preference", "status", "quoted_wait_time", "actual_wait_time", "queue_position", "seated_at", "no_show_at", "cancelled_at", "customer_id", "created_at", "updated_at", "uuid") SELECT "id", "name", "email", "phone", "party_size", "check_in_time", "table_preference", "status", "quoted_wait_time", "actual_wait_time", "queue_position", "seated_at", "no_show_at", "cancelled_at", "customer_id", "created_at", "updated_at", "uuid" FROM "waitlist_restaurants";
DROP TABLE "waitlist_restaurants";
ALTER TABLE "_qb_tmp_waitlist_restaurants" RENAME TO "waitlist_restaurants";
CREATE UNIQUE INDEX IF NOT EXISTS "waitlist_restaurants_waitlist_restaurants_uuid_unique" ON "waitlist_restaurants" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_cards" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "column_id" INTEGER not null,
  "board_id" INTEGER not null REFERENCES "boards"("id"),
  "title" TEXT not null,
  "description" TEXT,
  "position" INTEGER,
  "created_by_user_id" INTEGER,
  "due_date" TEXT,
  "archived" INTEGER,
  "board_column_id" INTEGER REFERENCES "board_columns"("id"),
  "user_id" INTEGER REFERENCES "users"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_cards" ("id", "column_id", "board_id", "title", "description", "position", "created_by_user_id", "due_date", "archived", "created_at", "updated_at", "uuid") SELECT "id", "column_id", "board_id", "title", "description", "position", "created_by_user_id", "due_date", "archived", "created_at", "updated_at", "uuid" FROM "cards";
DROP TABLE "cards";
ALTER TABLE "_qb_tmp_cards" RENAME TO "cards";
CREATE UNIQUE INDEX IF NOT EXISTS "cards_cards_uuid_unique" ON "cards" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_payment_transactions" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT not null,
  "description" TEXT,
  "amount" INTEGER not null,
  "type" TEXT not null,
  "provider_id" TEXT,
  "user_id" INTEGER REFERENCES "users"("id"),
  "payment_method_id" INTEGER REFERENCES "payment_methods"("id"),
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_payment_transactions" ("id", "name", "description", "amount", "type", "provider_id", "user_id", "payment_method_id", "uuid") SELECT "id", "name", "description", "amount", "type", "provider_id", "user_id", "payment_method_id", "uuid" FROM "payment_transactions";
DROP TABLE "payment_transactions";
ALTER TABLE "_qb_tmp_payment_transactions" RENAME TO "payment_transactions";
CREATE UNIQUE INDEX IF NOT EXISTS "payment_transactions_payment_transactions_uuid_unique" ON "payment_transactions" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_reviews" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "rating" INTEGER not null,
  "title" TEXT not null,
  "content" TEXT not null,
  "is_verified_purchase" INTEGER,
  "is_approved" INTEGER,
  "is_featured" INTEGER,
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
CREATE UNIQUE INDEX IF NOT EXISTS "reviews_reviews_uuid_unique" ON "reviews" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_teams" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT not null,
  "description" TEXT,
  "member_count" INTEGER,
  "status" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_teams" ("id", "name", "description", "member_count", "status", "created_at", "updated_at", "uuid") SELECT "id", "name", "description", "member_count", "status", "created_at", "updated_at", "uuid" FROM "teams";
DROP TABLE "teams";
ALTER TABLE "_qb_tmp_teams" RENAME TO "teams";
CREATE UNIQUE INDEX IF NOT EXISTS "teams_teams_name_unique" ON "teams" ("name");
CREATE UNIQUE INDEX IF NOT EXISTS "teams_teams_uuid_unique" ON "teams" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_pages" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "title" TEXT not null,
  "template" TEXT not null,
  "views" INTEGER default 0,
  "published_at" TEXT,
  "conversions" INTEGER default 0,
  "author_id" INTEGER REFERENCES "authors"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_pages" ("id", "title", "template", "views", "published_at", "conversions", "author_id", "created_at", "updated_at", "uuid") SELECT "id", "title", "template", "views", "published_at", "conversions", "author_id", "created_at", "updated_at", "uuid" FROM "pages";
DROP TABLE "pages";
ALTER TABLE "_qb_tmp_pages" RENAME TO "pages";
CREATE UNIQUE INDEX IF NOT EXISTS "pages_pages_uuid_unique" ON "pages" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_requests" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "method" TEXT CHECK ("method" IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD')),
  "path" TEXT,
  "status_code" INTEGER,
  "duration_ms" INTEGER,
  "ip_address" TEXT,
  "memory_usage" INTEGER,
  "user_agent" TEXT,
  "error_message" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "deleted_at" TEXT
);
INSERT INTO "_qb_tmp_requests" ("id", "method", "path", "status_code", "duration_ms", "ip_address", "memory_usage", "user_agent", "error_message", "created_at", "updated_at", "deleted_at") SELECT "id", "method", "path", "status_code", "duration_ms", "ip_address", "memory_usage", "user_agent", "error_message", "created_at", "updated_at", "deleted_at" FROM "requests";
DROP TABLE "requests";
ALTER TABLE "_qb_tmp_requests" RENAME TO "requests";
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
  "is_default" INTEGER,
  "product_id" INTEGER REFERENCES "products"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_product_units" ("id", "name", "abbreviation", "type", "description", "is_default", "product_id", "created_at", "updated_at", "uuid") SELECT "id", "name", "abbreviation", "type", "description", "is_default", "product_id", "created_at", "updated_at", "uuid" FROM "product_units";
DROP TABLE "product_units";
ALTER TABLE "_qb_tmp_product_units" RENAME TO "product_units";
CREATE UNIQUE INDEX IF NOT EXISTS "product_units_product_units_uuid_unique" ON "product_units" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_authors" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT not null,
  "email" TEXT not null,
  "bio" TEXT,
  "avatar" TEXT,
  "user_id" INTEGER REFERENCES "users"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_authors" ("id", "name", "email", "bio", "avatar", "user_id", "created_at", "updated_at", "uuid") SELECT "id", "name", "email", "bio", "avatar", "user_id", "created_at", "updated_at", "uuid" FROM "authors";
DROP TABLE "authors";
ALTER TABLE "_qb_tmp_authors" RENAME TO "authors";
CREATE INDEX IF NOT EXISTS "authors_authors_email_name_index" ON "authors" ("email", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "authors_authors_email_unique" ON "authors" ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "authors_authors_uuid_unique" ON "authors" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_subscribers" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "email" TEXT not null,
  "status" TEXT CHECK ("status" IN ('subscribed', 'unsubscribed', 'pending', 'bounced')) not null default 'subscribed',
  "source" TEXT default 'homepage',
  "unsubscribed_at" TEXT,
  "user_id" INTEGER REFERENCES "users"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_subscribers" ("id", "email", "status", "source", "user_id", "created_at", "updated_at", "uuid") SELECT "id", "email", "status", "source", "user_id", "created_at", "updated_at", "uuid" FROM "subscribers";
DROP TABLE "subscribers";
ALTER TABLE "_qb_tmp_subscribers" RENAME TO "subscribers";
CREATE UNIQUE INDEX IF NOT EXISTS "subscribers_subscribers_email_unique" ON "subscribers" ("email");
CREATE UNIQUE INDEX IF NOT EXISTS "subscribers_subscribers_uuid_unique" ON "subscribers" ("uuid");
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
  "currency" TEXT,
  "status" TEXT not null,
  "purchaser_id" TEXT,
  "recipient_email" TEXT,
  "recipient_name" TEXT,
  "personal_message" TEXT,
  "is_digital" INTEGER,
  "is_reloadable" INTEGER,
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
CREATE UNIQUE INDEX IF NOT EXISTS "gift_cards_gift_cards_code_unique" ON "gift_cards" ("code");
CREATE UNIQUE INDEX IF NOT EXISTS "gift_cards_gift_cards_uuid_unique" ON "gift_cards" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_orders" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "status" TEXT not null,
  "total_amount" INTEGER not null,
  "tax_amount" INTEGER,
  "discount_amount" INTEGER,
  "delivery_fee" INTEGER,
  "tip_amount" INTEGER,
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
INSERT INTO "_qb_tmp_orders" ("id", "status", "total_amount", "tax_amount", "discount_amount", "delivery_fee", "tip_amount", "order_type", "delivery_address", "special_instructions", "estimated_delivery_time", "applied_coupon_id", "customer_id", "coupon_id", "created_at", "updated_at", "uuid") SELECT "id", "status", "total_amount", "tax_amount", "discount_amount", "delivery_fee", "tip_amount", "order_type", "delivery_address", "special_instructions", "estimated_delivery_time", "applied_coupon_id", "customer_id", "coupon_id", "created_at", "updated_at", "uuid" FROM "orders";
DROP TABLE "orders";
ALTER TABLE "_qb_tmp_orders" RENAME TO "orders";
CREATE UNIQUE INDEX IF NOT EXISTS "orders_orders_uuid_unique" ON "orders" ("uuid");
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
  "is_active" INTEGER not null,
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
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_tax_rates" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT not null,
  "rate" INTEGER not null,
  "type" TEXT not null,
  "country" TEXT not null,
  "region" TEXT CHECK ("region" IN ('North America', 'South America', 'Europe', 'Asia', 'Africa', 'Oceania', 'Antarctica')),
  "status" TEXT CHECK ("status" IN ('active', 'inactive')) default 'active',
  "is_default" INTEGER default 0,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_tax_rates" ("id", "name", "rate", "type", "country", "region", "status", "is_default", "created_at", "updated_at", "uuid") SELECT "id", "name", "rate", "type", "country", "region", "status", "is_default", "created_at", "updated_at", "uuid" FROM "tax_rates";
DROP TABLE "tax_rates";
ALTER TABLE "_qb_tmp_tax_rates" RENAME TO "tax_rates";
CREATE UNIQUE INDEX IF NOT EXISTS "tax_rates_tax_rates_uuid_unique" ON "tax_rates" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_notifications" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "type" TEXT not null,
  "data" TEXT not null,
  "read_at" TEXT,
  "user_id" INTEGER REFERENCES "users"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_notifications" ("id", "type", "data", "read_at", "user_id", "created_at", "updated_at", "uuid") SELECT "id", "type", "data", "read_at", "user_id", "created_at", "updated_at", "uuid" FROM "notifications";
DROP TABLE "notifications";
ALTER TABLE "_qb_tmp_notifications" RENAME TO "notifications";
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_notifications_uuid_unique" ON "notifications" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_transactions" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "amount" INTEGER not null,
  "status" TEXT not null,
  "payment_method" TEXT not null,
  "payment_details" TEXT,
  "transaction_reference" TEXT,
  "loyalty_points_earned" INTEGER,
  "loyalty_points_redeemed" INTEGER,
  "order_id" INTEGER REFERENCES "orders"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_transactions" ("id", "amount", "status", "payment_method", "payment_details", "transaction_reference", "loyalty_points_earned", "loyalty_points_redeemed", "order_id", "created_at", "updated_at", "uuid") SELECT "id", "amount", "status", "payment_method", "payment_details", "transaction_reference", "loyalty_points_earned", "loyalty_points_redeemed", "order_id", "created_at", "updated_at", "uuid" FROM "transactions";
DROP TABLE "transactions";
ALTER TABLE "_qb_tmp_transactions" RENAME TO "transactions";
CREATE UNIQUE INDEX IF NOT EXISTS "transactions_transactions_uuid_unique" ON "transactions" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_loyalty_points" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "wallet_id" TEXT not null,
  "points" INTEGER not null,
  "source" TEXT,
  "source_reference_id" TEXT,
  "description" TEXT,
  "expiry_date" TEXT,
  "is_used" INTEGER,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_loyalty_points" ("id", "wallet_id", "points", "source", "source_reference_id", "description", "expiry_date", "is_used", "created_at", "updated_at", "uuid") SELECT "id", "wallet_id", "points", "source", "source_reference_id", "description", "expiry_date", "is_used", "created_at", "updated_at", "uuid" FROM "loyalty_points";
DROP TABLE "loyalty_points";
ALTER TABLE "_qb_tmp_loyalty_points" RENAME TO "loyalty_points";
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_points_loyalty_points_uuid_unique" ON "loyalty_points" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_jobs" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "queue" TEXT not null,
  "payload" TEXT not null,
  "attempts" INTEGER,
  "available_at" INTEGER,
  "reserved_at" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
INSERT INTO "_qb_tmp_jobs" ("id", "queue", "payload", "attempts", "available_at", "reserved_at", "created_at", "updated_at") SELECT "id", "queue", "payload", "attempts", "available_at", "reserved_at", "created_at", "updated_at" FROM "jobs";
DROP TABLE "jobs";
ALTER TABLE "_qb_tmp_jobs" RENAME TO "jobs";
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_notification_deliveries" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "user_id" INTEGER REFERENCES "users"("id"),
  "channel" TEXT CHECK ("channel" IN ('email', 'sms', 'chat', 'database', 'push', 'broadcast')) not null,
  "recipient" TEXT not null,
  "subject" TEXT,
  "body" TEXT not null,
  "status" TEXT CHECK ("status" IN ('pending', 'sent', 'delivered', 'failed')) not null default 'pending',
  "error" TEXT,
  "metadata" TEXT,
  "sent_at" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
INSERT INTO "_qb_tmp_notification_deliveries" ("id", "user_id", "channel", "recipient", "subject", "body", "status", "error", "metadata", "sent_at", "created_at", "updated_at") SELECT "id", "user_id", "channel", "recipient", "subject", "body", "status", "error", "metadata", "sent_at", "created_at", "updated_at" FROM "notification_deliveries";
DROP TABLE "notification_deliveries";
ALTER TABLE "_qb_tmp_notification_deliveries" RENAME TO "notification_deliveries";
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_logs" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "timestamp" INTEGER not null,
  "type" TEXT CHECK ("type" IN ('warning', 'error', 'info', 'success')) not null,
  "source" TEXT CHECK ("source" IN ('file', 'cli', 'system')) not null,
  "message" TEXT not null,
  "project" TEXT not null,
  "stacktrace" TEXT not null,
  "file" TEXT not null,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
INSERT INTO "_qb_tmp_logs" ("id", "timestamp", "type", "source", "message", "project", "stacktrace", "file", "created_at", "updated_at") SELECT "id", "timestamp", "type", "source", "message", "project", "stacktrace", "file", "created_at", "updated_at" FROM "logs";
DROP TABLE "logs";
ALTER TABLE "_qb_tmp_logs" RENAME TO "logs";
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_subscriptions" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "type" TEXT not null,
  "plan" TEXT,
  "provider_id" TEXT not null,
  "provider_status" TEXT not null,
  "unit_price" INTEGER not null,
  "provider_type" TEXT not null,
  "provider_price_id" TEXT,
  "quantity" INTEGER,
  "trial_ends_at" TEXT,
  "ends_at" TEXT,
  "last_used_at" TEXT,
  "user_id" INTEGER REFERENCES "users"("id"),
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_subscriptions" ("id", "type", "plan", "provider_id", "provider_status", "unit_price", "provider_type", "provider_price_id", "quantity", "trial_ends_at", "ends_at", "last_used_at", "user_id", "uuid") SELECT "id", "type", "plan", "provider_id", "provider_status", "unit_price", "provider_type", "provider_price_id", "quantity", "trial_ends_at", "ends_at", "last_used_at", "user_id", "uuid" FROM "subscriptions";
DROP TABLE "subscriptions";
ALTER TABLE "_qb_tmp_subscriptions" RENAME TO "subscriptions";
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_subscriptions_provider_id_unique" ON "subscriptions" ("provider_id");
CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_subscriptions_uuid_unique" ON "subscriptions" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_loyalty_rewards" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT not null,
  "description" TEXT,
  "points_required" INTEGER not null,
  "reward_type" TEXT not null,
  "discount_percentage" INTEGER,
  "free_product_id" TEXT,
  "is_active" INTEGER,
  "expiry_days" INTEGER,
  "image_url" TEXT,
  "product_id" INTEGER REFERENCES "products"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_loyalty_rewards" ("id", "name", "description", "points_required", "reward_type", "discount_percentage", "free_product_id", "is_active", "expiry_days", "image_url", "product_id", "created_at", "updated_at", "uuid") SELECT "id", "name", "description", "points_required", "reward_type", "discount_percentage", "free_product_id", "is_active", "expiry_days", "image_url", "product_id", "created_at", "updated_at", "uuid" FROM "loyalty_rewards";
DROP TABLE "loyalty_rewards";
ALTER TABLE "_qb_tmp_loyalty_rewards" RENAME TO "loyalty_rewards";
CREATE UNIQUE INDEX IF NOT EXISTS "loyalty_rewards_loyalty_rewards_uuid_unique" ON "loyalty_rewards" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_errors" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "type" TEXT not null,
  "message" TEXT not null,
  "stack" TEXT,
  "status" INTEGER,
  "additional_info" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
INSERT INTO "_qb_tmp_errors" ("id", "type", "message", "stack", "status", "additional_info", "created_at", "updated_at") SELECT "id", "type", "message", "stack", "status", "additional_info", "created_at", "updated_at" FROM "errors";
DROP TABLE "errors";
ALTER TABLE "_qb_tmp_errors" RENAME TO "errors";
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_shipping_methods" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT not null,
  "description" TEXT,
  "base_rate" INTEGER not null,
  "free_shipping" INTEGER,
  "status" TEXT CHECK ("status" IN ('active', 'inactive', 'draft')) not null,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_shipping_methods" ("id", "name", "description", "base_rate", "free_shipping", "status", "created_at", "updated_at", "uuid") SELECT "id", "name", "description", "base_rate", "free_shipping", "status", "created_at", "updated_at", "uuid" FROM "shipping_methods";
DROP TABLE "shipping_methods";
ALTER TABLE "_qb_tmp_shipping_methods" RENAME TO "shipping_methods";
CREATE UNIQUE INDEX IF NOT EXISTS "shipping_methods_shipping_methods_uuid_unique" ON "shipping_methods" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_shipping_rates" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "weight_from" REAL not null,
  "weight_to" REAL not null,
  "rate" INTEGER not null,
  "shipping_method_id" INTEGER REFERENCES "shipping_methods"("id"),
  "shipping_zone_id" INTEGER REFERENCES "shipping_zones"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_shipping_rates" ("id", "weight_from", "weight_to", "rate", "shipping_method_id", "shipping_zone_id", "created_at", "updated_at", "uuid") SELECT "id", "weight_from", "weight_to", "rate", "shipping_method_id", "shipping_zone_id", "created_at", "updated_at", "uuid" FROM "shipping_rates";
DROP TABLE "shipping_rates";
ALTER TABLE "_qb_tmp_shipping_rates" RENAME TO "shipping_rates";
CREATE UNIQUE INDEX IF NOT EXISTS "shipping_rates_shipping_rates_uuid_unique" ON "shipping_rates" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_comments" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "author_name" TEXT not null,
  "author_email" TEXT not null,
  "content" TEXT not null,
  "body" TEXT,
  "post_title" TEXT,
  "status" TEXT CHECK ("status" IN ('pending', 'approved', 'spam', 'trash')) not null default 'pending',
  "ip_address" TEXT,
  "user_agent" TEXT,
  "is_approved" INTEGER default 0,
  "post_id" INTEGER REFERENCES "posts"("id"),
  "user_id" INTEGER REFERENCES "users"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_comments" ("id", "author_name", "author_email", "content", "body", "post_title", "status", "ip_address", "user_agent", "is_approved", "user_id", "created_at", "updated_at", "uuid") SELECT "id", "author_name", "author_email", "content", "body", "post_title", "status", "ip_address", "user_agent", "is_approved", "user_id", "created_at", "updated_at", "uuid" FROM "comments";
DROP TABLE "comments";
ALTER TABLE "_qb_tmp_comments" RENAME TO "comments";
CREATE UNIQUE INDEX IF NOT EXISTS "comments_comments_uuid_unique" ON "comments" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_carts" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "status" TEXT CHECK ("status" IN ('active', 'abandoned', 'converted', 'expired')) default 'active',
  "total_items" INTEGER default 0,
  "subtotal" INTEGER default 0,
  "tax_amount" INTEGER default 0,
  "discount_amount" INTEGER default 0,
  "total" INTEGER default 0,
  "expires_at" TEXT not null,
  "currency" TEXT default 'USD',
  "notes" TEXT,
  "applied_coupon_id" TEXT not null,
  "customer_id" INTEGER REFERENCES "customers"("id"),
  "coupon_id" INTEGER REFERENCES "coupons"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_carts" ("id", "status", "total_items", "subtotal", "tax_amount", "discount_amount", "total", "expires_at", "currency", "notes", "applied_coupon_id", "customer_id", "coupon_id", "created_at", "updated_at", "uuid") SELECT "id", "status", "total_items", "subtotal", "tax_amount", "discount_amount", "total", "expires_at", "currency", "notes", "applied_coupon_id", "customer_id", "coupon_id", "created_at", "updated_at", "uuid" FROM "carts";
DROP TABLE "carts";
ALTER TABLE "_qb_tmp_carts" RENAME TO "carts";
CREATE UNIQUE INDEX IF NOT EXISTS "carts_carts_uuid_unique" ON "carts" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_delivery_routes" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "driver" TEXT not null,
  "vehicle" TEXT not null,
  "stops" INTEGER not null,
  "delivery_time" INTEGER not null,
  "total_distance" INTEGER not null,
  "last_active" TEXT not null,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_delivery_routes" ("id", "driver", "vehicle", "stops", "delivery_time", "total_distance", "last_active", "created_at", "updated_at", "uuid") SELECT "id", "driver", "vehicle", "stops", "delivery_time", "total_distance", "last_active", "created_at", "updated_at", "uuid" FROM "delivery_routes";
DROP TABLE "delivery_routes";
ALTER TABLE "_qb_tmp_delivery_routes" RENAME TO "delivery_routes";
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_routes_delivery_routes_uuid_unique" ON "delivery_routes" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_cart_items" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "quantity" INTEGER not null,
  "unit_price" INTEGER not null,
  "total_price" INTEGER not null,
  "tax_rate" INTEGER,
  "tax_amount" INTEGER,
  "discount_percentage" INTEGER,
  "discount_amount" INTEGER,
  "product_name" TEXT not null,
  "product_sku" TEXT,
  "product_image" TEXT,
  "notes" TEXT,
  "cart_id" INTEGER REFERENCES "carts"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_cart_items" ("id", "quantity", "unit_price", "total_price", "tax_rate", "tax_amount", "discount_percentage", "discount_amount", "product_name", "product_sku", "product_image", "notes", "cart_id", "created_at", "updated_at", "uuid") SELECT "id", "quantity", "unit_price", "total_price", "tax_rate", "tax_amount", "discount_percentage", "discount_amount", "product_name", "product_sku", "product_image", "notes", "cart_id", "created_at", "updated_at", "uuid" FROM "cart_items";
DROP TABLE "cart_items";
ALTER TABLE "_qb_tmp_cart_items" RENAME TO "cart_items";
CREATE UNIQUE INDEX IF NOT EXISTS "cart_items_cart_items_uuid_unique" ON "cart_items" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_boards" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT not null,
  "description" TEXT,
  "icon" TEXT,
  "color" TEXT,
  "position" INTEGER,
  "archived" INTEGER,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_boards" ("id", "name", "description", "icon", "color", "position", "archived", "created_at", "updated_at", "uuid") SELECT "id", "name", "description", "icon", "color", "position", "archived", "created_at", "updated_at", "uuid" FROM "boards";
DROP TABLE "boards";
ALTER TABLE "_qb_tmp_boards" RENAME TO "boards";
CREATE UNIQUE INDEX IF NOT EXISTS "boards_boards_uuid_unique" ON "boards" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_card_comments" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "card_id" INTEGER not null REFERENCES "cards"("id"),
  "user_id" INTEGER REFERENCES "users"("id"),
  "body" TEXT not null,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_card_comments" ("id", "card_id", "user_id", "body", "created_at", "updated_at", "uuid") SELECT "id", "card_id", "user_id", "body", "created_at", "updated_at", "uuid" FROM "card_comments";
DROP TABLE "card_comments";
ALTER TABLE "_qb_tmp_card_comments" RENAME TO "card_comments";
CREATE UNIQUE INDEX IF NOT EXISTS "card_comments_card_comments_uuid_unique" ON "card_comments" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_posts" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "title" TEXT not null,
  "poster" TEXT,
  "content" TEXT not null,
  "excerpt" TEXT,
  "views" INTEGER default 0,
  "published_at" TEXT,
  "status" TEXT CHECK ("status" IN ('published', 'draft', 'archived')) not null default 'draft',
  "is_featured" INTEGER,
  "author_id" INTEGER REFERENCES "authors"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
INSERT INTO "_qb_tmp_posts" ("id", "title", "poster", "content", "excerpt", "views", "published_at", "status", "is_featured", "author_id", "created_at", "updated_at", "uuid") SELECT "id", "title", "poster", "content", "excerpt", "views", "published_at", "status", "is_featured", "author_id", "created_at", "updated_at", "uuid" FROM "posts";
DROP TABLE "posts";
ALTER TABLE "_qb_tmp_posts" RENAME TO "posts";
CREATE UNIQUE INDEX IF NOT EXISTS "posts_posts_uuid_unique" ON "posts" ("uuid");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_categorizable_models" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "category_id" INTEGER not null REFERENCES "categorizable"("id"),
  "categorizable_id" INTEGER not null,
  "categorizable_type" TEXT not null,
  "created_at" TEXT not null default CURRENT_TIMESTAMP
);
INSERT INTO "_qb_tmp_categorizable_models" ("id", "category_id", "categorizable_id", "categorizable_type", "created_at") SELECT "id", "category_id", "categorizable_id", "categorizable_type", "created_at" FROM "categorizable_models";
DROP TABLE "categorizable_models";
ALTER TABLE "_qb_tmp_categorizable_models" RENAME TO "categorizable_models";
CREATE INDEX IF NOT EXISTS "categorizable_models_categorizable_models_target_index" ON "categorizable_models" ("categorizable_id", "categorizable_type");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
