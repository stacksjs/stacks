CREATE TABLE IF NOT EXISTS "shipping_rates" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "weight_from" REAL,
  "weight_to" REAL,
  "rate" REAL,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT,
  "shipping_method_id" INTEGER REFERENCES "shipping_methods"("id"),
  "shipping_zone_id" INTEGER REFERENCES "shipping_zones"("id")
);