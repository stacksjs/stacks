// Force `@stacksjs/validation` to evaluate fully before any user model file
// runs `import { schema } from '@stacksjs/validation'`. Without this priming
// import, the auto-imports barrel triggers user models concurrently, and
// later models in the barrel see `schema` in TDZ (the validator hasn't
// reached its `export const schema = v` line yet because evaluation jumped
// into the user model graph first). Pulling it in here at the top of every
// `@stacksjs/orm` consumer's evaluation guarantees schema is bound first.
import '@stacksjs/validation'

export * from './utils/prunable'
export type { PrunableOptions } from './utils/prunable'
export * from './db'
export * from './subquery'
export * from './transaction'
export * from './model-types'
export * from './types'
export * from './utils'
export * from './define-model'

// Auto-configure the ORM database connection from project config.
// This ensures model queries work without manual configureOrm() calls.
import { configureOrm } from 'bun-query-builder'

function autoConfigureOrm(): void {
  try {
    const dbPath = process.env.DB_DATABASE_PATH || 'database/stacks.sqlite'
    const dialect = process.env.DB_CONNECTION || 'sqlite'

    if (dialect === 'sqlite') {
      configureOrm({ database: dbPath })
    }
  }
  catch {
    // Config not available yet — will be configured on first query via @stacksjs/database
  }
}

autoConfigureOrm()

// `@stacksjs/auth` (and other framework packages) statically imports
// `User from '@stacksjs/orm'`, so we have to provide it here. Loading via
// `await import` instead of `export *` keeps the rest of the model graph
// out of orm's evaluation graph — only User is pulled in, and only after
// orm has finished its own static-import phase. The await pauses orm's
// module evaluation just long enough to bind User without re-introducing
// the auto-imports → schema-TDZ cycle that re-exporting the whole barrel
// would cause.
//
// `loadUserlandModel` resolves the project root using `@stacksjs/path`,
// not a relative `../../../../../` path. The relative depth differs
// between the two layouts this package can run from:
//   - workspace: `storage/framework/core/orm/src/index.ts` → 5 ups
//   - installed: `node_modules/@stacksjs/orm/src/index.ts` → 4 ups
// projectPath() handles both because it walks up looking for the project
// root (package.json with no parent), so the same code works regardless.
async function loadUserlandModel(modelName: string): Promise<any> {
  const { path } = await import('@stacksjs/path')
  // 1) User override at app/Models/<Name>.ts
  const userPath = path.userModelsPath(`${modelName}.ts`)
  try {
    if (await Bun.file(userPath).exists()) {
      return (await import(userPath)).default
    }
  }
  catch { /* fall through to framework default */ }
  // 2) Framework default at storage/framework/defaults/app/Models/<Name>.ts
  //    Resolved via the framework path helper instead of a relative `..`
  //    so it works whether this package is loaded from
  //    `storage/framework/core/orm/` (workspace) or
  //    `node_modules/@stacksjs/orm/` (installed).
  const defaultPath = path.frameworkPath(`defaults/app/Models/${modelName}.ts`)
  return (await import(defaultPath)).default
}

export const User = await loadUserlandModel('User')

// Same lazy-export pattern for the two queue framework models. The CLI
// commands `buddy queue:status`, `queue:failed`, `queue:flush`,
// `queue:inspect`, `queue:monitor`, `queue:clear` import them as
// `import { Job, FailedJob } from '@stacksjs/orm'`. Prefer the userland
// publication (`app/Models/Job.ts`, dropped in by `buddy publish:model
// Job`) so projects that customize the queue model — renamed columns,
// extra observers, custom traits — see their version.
export const Job = await loadUserlandModel('Job')
export const FailedJob = await loadUserlandModel('FailedJob')

// Re-export type utilities from bun-query-builder so consumers can infer
// model types directly from defineModel() definitions
export type {
  InferAttributes,
  InferFillableAttributes,
  InferPrimaryKey,
  InferTableName,
  InferRelationNames,
  InferNumericColumns,
  InferColumnNames,
  ModelDefinition,
  ModelRow,
  ModelRowLoose,
  ModelCreateData,
  ModelCreateDataLoose,
} from 'bun-query-builder'

// ---------------------------------------------------------------------------
// Model row types — inferred from model definitions via bun-query-builder.
// These replace hand-written interfaces and stay in sync automatically.
// Consumers: import type { UserModel, NewUser } from '@stacksjs/orm'
// ---------------------------------------------------------------------------

// Use a relative import to the User model file directly. Bun's linker still
// records `import type` paths for graph resolution, so importing through the
// auto-imports barrel here would re-introduce the cycle that the removed
// `export * from '../../../auto-imports/models'` (above) was meant to break.
// The single-model path keeps the type chain narrow.
import type _UserModel from '../../../../../app/Models/User'

/** User model row type — inferred from the User model definition. */
export type UserModel = ModelRowLoose<typeof _UserModel>

/** Data required to create a new User — inferred fillable attributes. */
export type NewUser = ModelCreateDataLoose<typeof _UserModel>

// ---------------------------------------------------------------------------
// Polymorphic trait table types — used by @stacksjs/cms and database drivers.
// These describe trait-managed tables (categorizable, commentable, taggable)
// that don't have standalone model definitions. Once the trait system in
// bun-query-builder supports schema inference, these can be removed.
// ---------------------------------------------------------------------------

/** Row type for the polymorphic categories table (categorizable trait). */
export interface CategorizableTable {
  id?: number
  name: string
  slug: string
  description?: string
  is_active: boolean
  categorizable_type: string
  created_at?: string
  updated_at?: string
}

/** Row type for the category-model pivot table (categorizable trait). */
export interface CategorizableModelsTable {
  id?: number
  category_id: number
  categorizable_type: string
  categorizable_id: number
  created_at?: string
  updated_at?: string
}

/** Row type for the polymorphic comments table (commentable trait). */
export interface CommentablesTable {
  id?: number
  title: string
  body: string
  status: string
  approved_at: number | null
  rejected_at: number | null
  commentables_id: number
  commentables_type: string
  user_id: number | null
  created_at?: string
  updated_at?: string | null
}

/** Row type for the polymorphic tags table (taggable trait). */
export interface TaggableTable {
  id?: number
  name: string
  slug: string
  description?: string
  is_active: boolean
  taggable_type: string
  created_at?: string
  updated_at?: string
}
