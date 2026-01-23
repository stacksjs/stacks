CREATE TABLE IF NOT EXISTS "payments" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "amount" REAL,
  "method" TEXT,
  "status" TEXT,
  "currency" TEXT,
  "reference_number" TEXT,
  "card_last_four" TEXT,
  "card_brand" TEXT,
  "billing_email" TEXT,
  "transaction_id" TEXT,
  "payment_provider" TEXT,
  "refund_amount" REAL,
  "notes" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);