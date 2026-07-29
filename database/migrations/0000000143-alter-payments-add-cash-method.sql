PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_payments" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "amount" INTEGER not null,
  "method" TEXT CHECK ("method" IN ('cash', 'creditCard', 'debitCard', 'paypal', 'applePay', 'googlePay', 'bankTransfer', 'giftCard')) not null,
  "status" TEXT CHECK ("status" IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'partiallyRefunded', 'succeeded')) not null default 'pending',
  "currency" TEXT default 'USD',
  "reference_number" TEXT,
  "card_last_four" TEXT,
  "card_brand" TEXT,
  "billing_email" TEXT,
  "transaction_id" TEXT,
  "payment_provider" TEXT,
  "refund_amount" INTEGER default 0,
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
