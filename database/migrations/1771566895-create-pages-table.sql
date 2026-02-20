CREATE TABLE IF NOT EXISTS "pages" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "title" TEXT,
  "template" TEXT,
  "views" REAL default 0,
  "published_at" TEXT,
  "conversions" REAL default 0,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT,
  "author_id" INTEGER REFERENCES "authors"("id")
);