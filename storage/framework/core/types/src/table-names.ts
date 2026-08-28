/**
 * Every table this application's models write to.
 *
 * Derived from the models rather than listed beside them. The hand-written
 * union this replaces had 62 entries against 97 models, listed `tags` and
 * `comments` twice, and had no way to know about a table added since whoever
 * last edited it.
 *
 * `storage/framework/types/models.d.ts` fills the registry from the models
 * barrel and each model's own `table`, so the answer to "which tables are
 * there" is "the ones the models declare".
 */
// eslint-disable-next-line ts/no-empty-object-type -- augmentation target; empty by design
export interface TableRegistry {}

/**
 * The pivot tables the trait migrations own.
 *
 * Declared here rather than derived because no model declares them: they are
 * created by `migrateTraitTables()` for whichever models opt into the
 * commentable / taggable / categorizable traits. `traitTableNames()` in
 * `@stacksjs/database` is typed against this, so the runtime list and the type
 * cannot drift apart without a compile error.
 */
export type TraitTableName =
  | 'commentables'
  | 'taggables'
  | 'categorizables'
  | 'commentable_upvotes'
  | 'taggable_models'
  | 'categorizable_models'

/**
 * Every table the framework owns that no model declares.
 */
export type FrameworkTableName =
  | TraitTableName
  | 'categories_models'
  | 'passkeys'
  | 'password_resets'
  | 'migrations'

/**
 * A table name, as narrow as the application has made it.
 *
 * Falls back to `string` while the registry is empty, for the same reason
 * {@link ModelNames} does.
 */
export type TableNames =
  | (keyof TableRegistry extends never ? string : keyof TableRegistry & string)
  | FrameworkTableName
