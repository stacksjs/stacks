CREATE TABLE IF NOT EXISTS "posts" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "title" TEXT,
  "poster" TEXT,
  "content" TEXT,
  "excerpt" TEXT,
  "views" REAL default 0,
  "published_at" TEXT,
  "status" TEXT CHECK ("status" IN ('published', 'draft', 'archived')) default 'draft',
  "is_featured" REAL,
  "author_id" INTEGER,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);