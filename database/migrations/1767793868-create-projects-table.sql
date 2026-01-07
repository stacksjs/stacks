CREATE TABLE IF NOT EXISTS "projects" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "description" TEXT,
  "url" TEXT,
  "status" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);