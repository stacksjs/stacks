CREATE TABLE IF NOT EXISTS "product_units" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "abbreviation" TEXT,
  "type" TEXT,
  "description" TEXT,
  "is_default" INTEGER,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);