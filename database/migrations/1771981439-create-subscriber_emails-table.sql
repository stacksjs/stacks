CREATE TABLE IF NOT EXISTS "subscriber_emails" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "email" TEXT,
  "source" TEXT default 'homepage',
  "ip_address" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);