CREATE TABLE IF NOT EXISTS "categorizables" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "slug" TEXT,
  "description" TEXT,
  "categorizable_type" TEXT,
  "is_active" INTEGER DEFAULT 1,
  "created_at" TEXT DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
