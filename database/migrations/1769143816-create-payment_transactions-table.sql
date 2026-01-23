CREATE TABLE IF NOT EXISTS "payment_transactions" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "description" TEXT,
  "amount" REAL,
  "type" TEXT,
  "provider_id" TEXT
);