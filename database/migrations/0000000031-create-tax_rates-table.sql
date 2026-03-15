CREATE TABLE IF NOT EXISTS "tax_rates" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "rate" REAL,
  "type" TEXT,
  "country" TEXT,
  "region" TEXT CHECK ("region" IN ('North America', 'South America', 'Europe', 'Asia', 'Africa', 'Oceania', 'Antarctica')),
  "status" TEXT CHECK ("status" IN ('active', 'inactive')) default 'active',
  "is_default" INTEGER default 0,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);