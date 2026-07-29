CREATE TABLE IF NOT EXISTS "campaign_sends" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "campaign_id" INTEGER not null REFERENCES "campaigns"("id"),
  "subscriber_id" INTEGER not null REFERENCES "subscribers"("id"),
  "email_list_id" INTEGER not null REFERENCES "email_lists"("id"),
  "status" TEXT CHECK ("status" IN ('queued', 'sent', 'failed', 'bounced', 'complained')) not null default 'queued',
  "provider_message_id" TEXT,
  "error" TEXT,
  "sent_at" TEXT,
  "opened_at" TEXT,
  "clicked_at" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_sends_campaign_sends_uuid_unique" ON "campaign_sends" ("uuid");
