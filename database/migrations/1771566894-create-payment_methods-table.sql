CREATE TABLE IF NOT EXISTS "payment_methods" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "type" TEXT,
  "last_four" REAL,
  "brand" TEXT,
  "exp_month" REAL,
  "exp_year" REAL,
  "is_default" INTEGER,
  "provider_id" TEXT,
  "uuid" TEXT,
  "user_id" INTEGER REFERENCES "users"("id")
);