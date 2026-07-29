CREATE TABLE IF NOT EXISTS "email_lists" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT not null,
  "slug" TEXT,
  "description" TEXT,
  "subscriber_count" INTEGER default 0,
  "active_count" INTEGER default 0,
  "unsubscribed_count" INTEGER default 0,
  "bounced_count" INTEGER default 0,
  "status" TEXT CHECK ("status" IN ('active', 'inactive', 'archived')) not null default 'active',
  "is_public" INTEGER default 1,
  "double_opt_in" INTEGER default 1,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "email_lists_email_lists_slug_unique" ON "email_lists" ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "email_lists_email_lists_uuid_unique" ON "email_lists" ("uuid");
