CREATE TABLE IF NOT EXISTS "comments" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "author_name" TEXT,
  "author_email" TEXT,
  "content" TEXT,
  "body" TEXT,
  "post_title" TEXT,
  "status" TEXT CHECK ("status" IN ('pending', 'approved', 'spam', 'trash')) default 'pending',
  "ip_address" TEXT,
  "user_agent" TEXT,
  "is_approved" INTEGER default 0,
  "user_id" INTEGER,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
