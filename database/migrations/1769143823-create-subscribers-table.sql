CREATE TABLE IF NOT EXISTS "subscribers" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "subscribed" INTEGER,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);