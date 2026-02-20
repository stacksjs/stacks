CREATE TABLE IF NOT EXISTS "payment_transactions" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "description" TEXT,
  "amount" REAL,
  "type" TEXT,
  "provider_id" TEXT,
  "uuid" TEXT,
  "user_id" INTEGER REFERENCES "users"("id"),
  "payment_method_id" INTEGER REFERENCES "payment_methods"("id")
);