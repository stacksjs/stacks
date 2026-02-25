CREATE TABLE IF NOT EXISTS "posts" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "title" TEXT,
  "slug" TEXT,
  "poster" TEXT,
  "content" TEXT,
  "body" TEXT,
  "excerpt" TEXT,
  "views" REAL default 0,
  "published_at" TEXT,
  "status" TEXT default 'draft',
  "is_featured" REAL,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);