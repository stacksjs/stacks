-- The categorizable model TRAIT (orm/src/traits/categorizable.ts) links a
-- category to a specific owning row via `categorizable_id` (the owner's id) plus
-- `categorizable_type`, and filters on it in categories()/removeCategory(). The
-- original categorizable_models migration (0000000117) omitted the column
-- because the CMS module's storeCategorizableModel() writes only category_id +
-- type. Added here (nullable) so the trait's per-instance links work while the
-- CMS module's type-level rows still insert with it left null.
--
-- Separate additive migration rather than editing 0000000117, which is already
-- applied where it ran.
ALTER TABLE "categorizable_models" ADD COLUMN "categorizable_id" INTEGER;

CREATE INDEX IF NOT EXISTS "categorizable_models_owner_index"
  ON "categorizable_models" ("categorizable_type", "categorizable_id");
