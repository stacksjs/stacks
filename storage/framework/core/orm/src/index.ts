export * from '../../../orm/src'
export * from './db'
export * from './subquery'
export * from './transaction'
export * from './model-types'
export * from './types'
export * from './utils'
export * from './define-model'

// Re-export all model instances so Actions can use: import { User } from '@stacksjs/orm'
export * from '../../../auto-imports/models'

// Re-export type utilities from bun-query-builder so consumers can infer
// model types directly from defineModel() definitions
export type { InferAttributes, InferPrimaryKey, InferTableName, ModelDefinition } from 'bun-query-builder'
export type { InferRelationNames } from 'bun-query-builder'


// ---------------------------------------------------------------------------
// Shared type interfaces used by framework packages (@stacksjs/payments,
// @stacksjs/auth, etc.) for structural typing of model rows and pivot tables.
// ---------------------------------------------------------------------------

/** Type interface representing a User model row. */
export interface UserModel {
  id: number
  email: string
  name: string
  password: string
  uuid: string
  two_factor_secret: string | null
  public_key: string | null
  stripe_id: string | null
  created_at: string
  updated_at: string | null
  deleted_at: string | null
  hasStripeId: () => boolean
  update: (data: Record<string, unknown>) => Promise<unknown>
  [key: string]: unknown
}

/** Type interface for creating a new User record. */
export interface NewUser {
  email: string
  password: string
  name: string
  [key: string]: unknown
}

// Model type stubs (runtime instances re-exported from auto-imports/models above)

/** Stub interface for the categorizables table row. */
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

/** Stub interface for the categorizable_models pivot table row. */
export interface CategorizableModelsTable {
  id?: number
  category_id: number
  categorizable_type: string
  categorizable_id: number
  created_at?: string
  updated_at?: string
}

/** Stub interface for the commentables table row. */
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

/** Stub interface for the taggables table row. */
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
