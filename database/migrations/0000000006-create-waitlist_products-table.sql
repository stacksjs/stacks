CREATE TABLE IF NOT EXISTS "waitlist_products" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "quantity" REAL,
  "notification_preference" TEXT CHECK ("notification_preference" IN ('sms', 'email', 'both')),
  "source" TEXT,
  "notes" TEXT,
  "status" TEXT CHECK ("status" IN ('waiting', 'purchased', 'notified', 'cancelled')) default 'waiting',
  "notified_at" TEXT,
  "purchased_at" TEXT,
  "cancelled_at" TEXT,
  "product_id" INTEGER,
  "customer_id" INTEGER,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);