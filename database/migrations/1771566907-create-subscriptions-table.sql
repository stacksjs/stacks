CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "type" TEXT,
  "plan" TEXT,
  "provider_id" TEXT,
  "provider_status" TEXT,
  "unit_price" REAL,
  "provider_type" TEXT,
  "provider_price_id" TEXT,
  "quantity" REAL,
  "trial_ends_at" TEXT,
  "ends_at" TEXT,
  "last_used_at" TEXT,
  "uuid" TEXT,
  "user_id" INTEGER REFERENCES "users"("id")
);