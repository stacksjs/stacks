CREATE TABLE IF NOT EXISTS "comments" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "author_name" TEXT,
  "author_email" TEXT,
  "content" TEXT,
  "post_title" TEXT,
  "status" TEXT default 'pending',
  "ip_address" TEXT,
  "user_agent" TEXT,
  "is_approved" REAL default 0,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT,
  "post_id" INTEGER REFERENCES "posts"("id"),
  "user_id" INTEGER REFERENCES "users"("id")
);