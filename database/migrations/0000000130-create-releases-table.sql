CREATE TABLE IF NOT EXISTS "releases" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "version" TEXT not null,
  "type" TEXT not null,
  "status" TEXT not null,
  "notes" TEXT,
  "downloads" INTEGER,
  "author" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "releases_releases_uuid_unique" ON "releases" ("uuid");
