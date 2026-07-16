-- Trait table for the `taggable` model trait (Post declares `taggable: true`).
-- `taggable_type` scopes a tag to an owning model (e.g. 'posts'). Backs the CMS
-- `taggables` module used by the dashboard. Schema matches TaggableTable in
-- storage/framework/core/orm/src/generated/table-traits.ts and the columns the
-- CMS module filters on (id, name, slug, is_active, taggable_type).
CREATE TABLE IF NOT EXISTS "taggables" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "taggable_id" INTEGER,
  "taggable_type" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS "taggables_type_slug_unique"
  ON "taggables" ("taggable_type", "slug");
