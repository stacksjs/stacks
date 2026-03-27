export * from '../../../orm/src'
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

// Re-export all model instances so Actions can use: import { User } from '@stacksjs/orm'
export * from '../../../auto-imports/models'

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

import type _User from '../../../auto-imports/models'

/** User model row type — inferred from the User model definition. */
export type UserModel = ModelRowLoose<typeof _User.User>

/** Data required to create a new User — inferred fillable attributes. */
export type NewUser = ModelCreateDataLoose<typeof _User.User>

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
