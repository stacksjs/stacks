-- Join table linking a taggable row to owning model instances. `tag_id` ->
-- taggables.id, `taggable_type` -> the owning table (e.g. 'posts'). Matches
-- TaggableModelsTable in
-- storage/framework/core/orm/src/generated/table-traits.ts and the CMS
-- taggables module's `selectFrom('taggable_models')` reads.
CREATE TABLE IF NOT EXISTS "taggable_models" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "tag_id" INTEGER NOT NULL,
  "taggable_type" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT
);

CREATE INDEX IF NOT EXISTS "taggable_models_tag_index"
  ON "taggable_models" ("tag_id");

CREATE INDEX IF NOT EXISTS "taggable_models_type_index"
  ON "taggable_models" ("taggable_type");
