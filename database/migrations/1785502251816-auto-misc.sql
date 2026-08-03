PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_categorizable_models" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "category_id" INTEGER not null REFERENCES "categories"("id"),
  "categorizable_id" INTEGER not null,
  "categorizable_type" TEXT not null default 'posts',
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
INSERT INTO "_qb_tmp_categorizable_models" ("id", "category_id", "categorizable_id", "categorizable_type", "created_at", "updated_at") SELECT "id", "category_id", "categorizable_id", "categorizable_type", "created_at", "updated_at" FROM "categorizable_models";
DROP TABLE "categorizable_models";
ALTER TABLE "_qb_tmp_categorizable_models" RENAME TO "categorizable_models";
CREATE UNIQUE INDEX IF NOT EXISTS "categorizable_models_category_id_categorizable_id_categorizable_type_unique" ON "categorizable_models" ("category_id", "categorizable_id", "categorizable_type");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_taggable_models" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "taggable_id" INTEGER not null,
  "tag_id" INTEGER not null REFERENCES "tags"("id"),
  "taggable_type" TEXT not null default 'posts',
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
INSERT INTO "_qb_tmp_taggable_models" ("id", "taggable_id", "tag_id", "taggable_type", "created_at", "updated_at") SELECT "id", "taggable_id", "tag_id", "taggable_type", "created_at", "updated_at" FROM "taggable_models";
DROP TABLE "taggable_models";
ALTER TABLE "_qb_tmp_taggable_models" RENAME TO "taggable_models";
CREATE UNIQUE INDEX IF NOT EXISTS "taggable_models_tag_id_taggable_id_taggable_type_unique" ON "taggable_models" ("tag_id", "taggable_id", "taggable_type");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
