CREATE TABLE IF NOT EXISTS "waitlist_products" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "quantity" REAL,
  "notification_preference" TEXT,
  "source" TEXT,
  "notes" TEXT,
  "status" TEXT default 'waiting',
  "notified_at" TEXT,
  "purchased_at" TEXT,
  "cancelled_at" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT,
  "product_id" INTEGER REFERENCES "products"("id"),
  "customer_id" INTEGER REFERENCES "customers"("id")
);