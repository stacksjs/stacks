CREATE TABLE IF NOT EXISTS "waitlist_restaurants" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "party_size" REAL,
  "check_in_time" TEXT,
  "table_preference" TEXT CHECK ("table_preference" IN ('indoor', 'bar', 'booth', 'no_preference')),
  "status" TEXT CHECK ("status" IN ('waiting', 'seated', 'cancelled', 'no_show')) default 'waiting',
  "quoted_wait_time" REAL,
  "actual_wait_time" REAL,
  "queue_position" REAL,
  "seated_at" TEXT,
  "no_show_at" TEXT,
  "cancelled_at" TEXT,
  "customer_id" INTEGER,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);