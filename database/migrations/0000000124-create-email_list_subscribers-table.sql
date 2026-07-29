CREATE TABLE IF NOT EXISTS "email_list_subscribers" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "email_list_id" INTEGER not null REFERENCES "email_lists"("id"),
  "subscriber_id" INTEGER not null REFERENCES "subscribers"("id"),
  "status" TEXT CHECK ("status" IN ('subscribed', 'unsubscribed', 'pending', 'bounced')) not null default 'subscribed',
  "source" TEXT default 'api',
  "subscribed_at" TEXT,
  "unsubscribed_at" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "email_list_subscribers_email_list_subscribers_uuid_unique" ON "email_list_subscribers" ("uuid");
