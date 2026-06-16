CREATE TABLE IF NOT EXISTS "authors" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "uuid" TEXT,
  "name" TEXT,
  "email" TEXT,
  "bio" TEXT,
  "avatar" TEXT,
  "user_id" INTEGER,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);