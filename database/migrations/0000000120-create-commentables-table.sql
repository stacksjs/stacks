-- Trait table for the `commentable` model trait. Holds comments attached
-- polymorphically to an owning model: `commentables_id` + `commentables_type`
-- identify the owner (e.g. 123 / 'posts'). Backs the CMS `commentables` module,
-- which the dashboard comments page calls. Schema matches CommentablesTable in
-- storage/framework/core/orm/src/generated/table-traits.ts and the columns the
-- CMS module filters on (id, status, commentables_id, commentables_type,
-- created_at).
--
-- This is a distinct table from `comments` (0000000099). The CMS module and the
-- generated ORM type use this polymorphic `commentables` table; the model-trait
-- query methods in orm/src/traits/commentable.ts still target `comments` with
-- the same column names, which is a separate, pre-existing inconsistency noted
-- for follow-up. The dashboard uses the CMS module path, so this table is what
-- makes the dashboard comments feature work.
CREATE TABLE IF NOT EXISTS "commentables" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "approved_at" INTEGER,
  "rejected_at" INTEGER,
  "commentables_id" INTEGER NOT NULL,
  "commentables_type" TEXT NOT NULL,
  "user_id" INTEGER,
  "is_active" INTEGER,
  "created_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TEXT
);

CREATE INDEX IF NOT EXISTS "commentables_owner_index"
  ON "commentables" ("commentables_type", "commentables_id");

CREATE INDEX IF NOT EXISTS "commentables_status_index"
  ON "commentables" ("status");
