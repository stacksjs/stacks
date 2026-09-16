-- Repair: categorizable_models.category_id referenced the commerce `categories`
-- table, but CMS allocates those ids in `categorizables`.
--
-- 0000000117 created the column with no foreign key and its comment records the
-- intent: `category_id` -> categorizables.id. The generated `_qb_tmp_` rebuilds
-- in 0000000151 and 1785502251816 then added REFERENCES "categories"("id"),
-- because the generator infers a pivot's referenced table from the column name
-- (`category_id` -> `categories`) rather than from the relation's declared
-- model (`Categorizable` -> `categorizables`).
--
-- With foreign keys enforced, that made a CMS category impossible to link: the
-- insert fails unless an identically numbered commerce category happens to
-- exist. Coincidentally matching ids concealed it.
--
-- Rebuild preserves every row, its timestamps, and the unique index. The owner
-- column `categorizable_id` is deliberately left WITHOUT a foreign key: the
-- pivot is polymorphic, `categorizable_type` selects the owning table, so no
-- single table is correct to reference. The final installed schema had no owner
-- FK either, so this changes nothing there.
PRAGMA foreign_keys=OFF;
BEGIN;
CREATE TABLE "_qb_tmp_categorizable_models" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "category_id" INTEGER not null REFERENCES "categorizables"("id"),
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
