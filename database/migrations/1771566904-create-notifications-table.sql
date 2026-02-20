CREATE TABLE IF NOT EXISTS "notifications" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "type" TEXT,
  "channel" TEXT,
  "recipient" TEXT,
  "subject" TEXT,
  "body" TEXT,
  "status" TEXT default 'pending',
  "read_at" TEXT,
  "sent_at" TEXT,
  "metadata" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT,
  "user_id" INTEGER REFERENCES "users"("id")
);