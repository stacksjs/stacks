CREATE TABLE IF NOT EXISTS "taggable_models" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "tag_id" INTEGER,
  "taggable_id" INTEGER,
  "taggable_type" TEXT,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
