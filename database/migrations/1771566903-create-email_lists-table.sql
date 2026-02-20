CREATE TABLE IF NOT EXISTS "email_lists" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "description" TEXT,
  "subscriber_count" REAL default 0,
  "active_count" REAL default 0,
  "unsubscribed_count" REAL default 0,
  "bounced_count" REAL default 0,
  "status" TEXT default 'active',
  "is_public" REAL default 1,
  "double_opt_in" REAL default 1,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);