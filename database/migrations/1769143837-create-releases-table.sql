CREATE TABLE IF NOT EXISTS "releases" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "version" TEXT,
  "release_notes" TEXT,
  "status" TEXT,
  "download_count" REAL default 0,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);