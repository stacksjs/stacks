CREATE TABLE IF NOT EXISTS "social_posts" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "content" TEXT not null,
  "platform" TEXT CHECK ("platform" IN ('twitter', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube')) not null,
  "status" TEXT CHECK ("status" IN ('draft', 'scheduled', 'published', 'failed')) not null default 'draft',
  "scheduled_at" TEXT,
  "published_at" TEXT,
  "likes" INTEGER default 0,
  "shares" INTEGER default 0,
  "comments" INTEGER default 0,
  "reach" INTEGER default 0,
  "image_url" TEXT,
  "external_id" TEXT,
  "user_id" INTEGER REFERENCES "users"("id"),
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT,
  "uuid" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "social_posts_social_posts_uuid_unique" ON "social_posts" ("uuid");
