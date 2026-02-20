CREATE TABLE IF NOT EXISTS "social_posts" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "content" TEXT,
  "platform" TEXT,
  "status" TEXT default 'draft',
  "scheduled_at" TEXT,
  "published_at" TEXT,
  "likes" REAL default 0,
  "shares" REAL default 0,
  "comments" REAL default 0,
  "reach" REAL default 0,
  "image_url" TEXT,
  "external_id" TEXT,
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT,
  "user_id" INTEGER REFERENCES "users"("id")
);