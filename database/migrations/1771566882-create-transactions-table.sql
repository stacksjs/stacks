CREATE TABLE IF NOT EXISTS "transactions" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "amount" REAL,
  "status" TEXT,
  "payment_method" TEXT,
  "payment_details" TEXT,
  "transaction_reference" TEXT,
  "loyalty_points_earned" REAL,
  "loyalty_points_redeemed" REAL,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT,
  "order_id" INTEGER REFERENCES "orders"("id")
);