CREATE TABLE IF NOT EXISTS "categorizable_models" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "category_id" INTEGER,
  "categorizable_id" INTEGER,
  "categorizable_type" TEXT,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
