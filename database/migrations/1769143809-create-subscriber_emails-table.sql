CREATE TABLE IF NOT EXISTS "subscriber_emails" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "email" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "deleted_at" TEXT
);