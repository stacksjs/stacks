CREATE TABLE IF NOT EXISTS "manufacturers" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "manufacturer" TEXT,
  "description" TEXT,
  "country" TEXT,
  "featured" INTEGER,
  "uuid" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);