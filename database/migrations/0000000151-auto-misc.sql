PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_categorizable_models" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "categorizable_id" INTEGER not null REFERENCES "posts"("id"),
  "category_id" INTEGER not null REFERENCES "categories"("id"),
  "categorizable_type" TEXT not null default 'posts',
  "created_at" TEXT not null default CURRENT_TIMESTAMP,
  "updated_at" TEXT
);
INSERT INTO "_qb_tmp_categorizable_models" ("id", "categorizable_id", "category_id", "categorizable_type", "created_at") SELECT "id", "categorizable_id", "category_id", "categorizable_type", "created_at" FROM "categorizable_models";
DROP TABLE "categorizable_models";
ALTER TABLE "_qb_tmp_categorizable_models" RENAME TO "categorizable_models";
CREATE UNIQUE INDEX IF NOT EXISTS "categorizable_models_owner_unique"
  ON "categorizable_models" ("category_id", "categorizable_id", "categorizable_type");
CREATE INDEX IF NOT EXISTS "categorizable_models_target_index"
  ON "categorizable_models" ("categorizable_id", "categorizable_type");
PRAGMA foreign_key_check;
COMMIT;
PRAGMA foreign_keys=ON;
