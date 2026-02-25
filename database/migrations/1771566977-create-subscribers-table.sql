CREATE TABLE IF NOT EXISTS "subscribers" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "email" TEXT NOT NULL,
  "status" TEXT default 'subscribed',
  "source" TEXT,
  "unsubscribed_at" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT,
  "user_id" INTEGER REFERENCES "users"("id")
);
