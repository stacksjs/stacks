CREATE TABLE IF NOT EXISTS "tags" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "slug" TEXT,
  "description" TEXT,
  "post_count" REAL default 0,
  "color" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);