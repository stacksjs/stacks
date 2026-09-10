-- Join table linking a TAG to owning model instances. `tag_id` -> tags.id,
-- `taggable_type` -> the owning table (e.g. 'posts', 'storage_items').
--
-- `tags`, not `taggables`. This comment said `taggables` for the life of the
-- table and was wrong (stacksjs/stacks#2579): every writer of this pivot writes
-- a `tags` id - the dashboard validates `tagIds` against `tags` in
-- `post-input.ts`, writes them in `syncPostRelations`, reads them back in
-- `PostIndexAction` and counts them in `TagIndexAction` - and the `Post` and
-- `Tag` models both declare the relation as `model: 'Tag'`.
--
-- `taggables` is a real table, but a different mechanism: `createTaggableMethods`
-- in @stacksjs/orm writes tag names straight into it with no pivot row at all.
-- Four queries in the CMS joined this pivot to it and silently returned nothing.
CREATE TABLE IF NOT EXISTS "taggable_models" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "tag_id" INTEGER NOT NULL,
  "taggable_id" INTEGER NOT NULL,
  "taggable_type" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT
);

CREATE INDEX IF NOT EXISTS "taggable_models_tag_index"
  ON "taggable_models" ("tag_id");

CREATE INDEX IF NOT EXISTS "taggable_models_type_index"
  ON "taggable_models" ("taggable_type");

CREATE UNIQUE INDEX IF NOT EXISTS "taggable_models_owner_unique"
  ON "taggable_models" ("tag_id", "taggable_id", "taggable_type");
