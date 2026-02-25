CREATE TABLE IF NOT EXISTS "subscriber_emails" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "email" TEXT NOT NULL,
  "source" TEXT default 'homepage',
  "ip_address" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT,
  "subscriber_id" INTEGER REFERENCES "subscribers"("id")
);
