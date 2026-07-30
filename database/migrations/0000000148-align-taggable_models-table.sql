PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_taggable_models" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "taggable_id" INTEGER not null REFERENCES "posts"("id"),
  "tag_id" INTEGER not null REFERENCES "tags"("id"),
  "taggable_type" TEXT not null default 'posts',
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
INSERT INTO "_qb_tmp_taggable_models" ("id", "taggable_id", "tag_id", "taggable_type", "created_at", "updated_at")
SELECT "id", "taggable_id", "tag_id", "taggable_type", "created_at", "updated_at" FROM "taggable_models";
DROP TABLE "taggable_models";
ALTER TABLE "_qb_tmp_taggable_models" RENAME TO "taggable_models";
CREATE UNIQUE INDEX IF NOT EXISTS "taggable_models_owner_unique"
  ON "taggable_models" ("tag_id", "taggable_id", "taggable_type");
CREATE INDEX IF NOT EXISTS "taggable_models_target_index"
  ON "taggable_models" ("taggable_id", "taggable_type");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
