CREATE UNIQUE INDEX IF NOT EXISTS "categorizable_models_owner_unique"
  ON "categorizable_models" ("category_id", "categorizable_id", "categorizable_type");

CREATE UNIQUE INDEX IF NOT EXISTS "taggable_models_owner_unique"
  ON "taggable_models" ("tag_id", "taggable_id", "taggable_type");
