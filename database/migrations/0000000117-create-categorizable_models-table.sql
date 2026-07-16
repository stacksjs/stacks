-- Join table recording which categories apply to an owning model type.
-- `category_id` -> categorizables.id, `categorizable_type` -> the owning table
-- (e.g. 'posts'). Columns match the framework's own CMS test fixture
-- (storage/framework/core/cms/src/tests/setup.ts) and what the categorizables
-- module actually writes in storeCategorizableModel().
CREATE TABLE IF NOT EXISTS "categorizable_models" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "category_id" INTEGER NOT NULL,
  "categorizable_type" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT
);

CREATE INDEX IF NOT EXISTS "categorizable_models_category_index"
  ON "categorizable_models" ("category_id");

CREATE INDEX IF NOT EXISTS "categorizable_models_type_index"
  ON "categorizable_models" ("categorizable_type");
