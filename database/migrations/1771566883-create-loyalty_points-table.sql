CREATE TABLE IF NOT EXISTS "loyalty_points" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "wallet_id" TEXT,
  "points" REAL,
  "source" TEXT,
  "source_reference_id" TEXT,
  "description" TEXT,
  "expiry_date" TEXT,
  "is_used" INTEGER,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);