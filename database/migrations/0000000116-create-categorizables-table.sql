-- Trait table for the `categorizable` model trait (Post declares `categorizable: true`).
-- Holds the categories a model can be filed under; `categorizable_type` scopes a
-- row to an owning model (e.g. 'posts'). Backs the CMS `categorizables` module,
-- which the dashboard content pages call. Schema matches CategorizableTable in
-- storage/framework/core/orm/src/generated/table-traits.ts and the fixture in
-- storage/framework/core/cms/src/tests/setup.ts.
--
-- Only the mysql driver created the trait pivot tables; sqlite (dev + the box)
-- never did, so this and its siblings were missing and every categorize/tag call
-- hit a non-existent table.
CREATE TABLE IF NOT EXISTS "categorizables" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "categorizable_type" TEXT NOT NULL,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS "categorizables_type_slug_unique"
  ON "categorizables" ("categorizable_type", "slug");
