export * from '../../../orm/src'
export * from './db'
export * from './subquery'
export * from './transaction'
export * from './model-types'
export * from './types'
export * from './utils'
export * from './define-model'

// Re-export type utilities from bun-query-builder so consumers can infer
// model types directly from defineModel() definitions
export type { InferAttributes, InferPrimaryKey, InferTableName, ModelDefinition } from 'bun-query-builder'
export type { InferRelationNames } from 'bun-query-builder'

// Export User model from db package
export { default as User } from '../../db/src/orm/Models/User'

// ---------------------------------------------------------------------------
// Stub exports for generated model types.
// These types are normally code-generated from model definitions. The stubs
// below keep the typecheck green when the generated files have not been
// produced yet (e.g. in CI or a fresh clone).
// ---------------------------------------------------------------------------

/** Stub type representing a User model instance (generated at build time). */
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

/** Stub type for creating a new User record. */
export interface NewUser {
  email: string
  password: string
  name: string
  [key: string]: unknown
}

/** Stub model class for the jobs table. */
export const Job: {
  where: (column: string, ...args: unknown[]) => { get: () => Promise<{ id: number, queue: string, delete: () => Promise<void>, [key: string]: unknown }[]> }
  all: () => Promise<{ id: number, queue: string, delete: () => Promise<void>, [key: string]: unknown }[]>
  find: (id: number) => Promise<{ id: number, queue: string, [key: string]: unknown } | undefined>
  [key: string]: unknown
} = undefined as never

/** Stub model class for the failed_jobs table. */
export const FailedJob: {
  where: (column: string, ...args: unknown[]) => { get: () => Promise<{ id: number, queue: string, failed_at: string, exception: string, [key: string]: unknown }[]> }
  all: () => Promise<{ id: number, queue: string, failed_at: string, exception: string, [key: string]: unknown }[]>
  find: (id: number) => Promise<{ id: number, queue: string, [key: string]: unknown } | undefined>
  [key: string]: unknown
} = undefined as never

/** Stub model class for the payment_methods table. */
export const PaymentMethod: {
  create: (data: Record<string, unknown>) => Promise<Record<string, unknown>>
  find: (id: number) => Promise<{ id: number, provider_id: string, is_default: boolean, update: (data: Record<string, unknown>) => Promise<unknown>, delete: () => Promise<void>, [key: string]: unknown } | undefined>
  where: (column: string, ...args: unknown[]) => { where: (column: string, ...args: unknown[]) => { first: () => Promise<Record<string, unknown> | undefined>, [key: string]: unknown }, first: () => Promise<Record<string, unknown> | undefined>, [key: string]: unknown }
  [key: string]: unknown
} = undefined as never

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
