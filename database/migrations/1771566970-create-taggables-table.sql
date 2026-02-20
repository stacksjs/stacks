CREATE TABLE IF NOT EXISTS "taggables" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "slug" TEXT,
  "description" TEXT,
  "is_active" INTEGER DEFAULT 1,
  "taggable_type" TEXT,
  "taggable_id" INTEGER,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
