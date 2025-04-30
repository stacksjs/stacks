import type { VineType } from '@stacksjs/types'
import type { Request } from '../core/router/src/request'

interface ValidationField {
  rule: VineType
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}

interface RequestDataMigrations {
  name: string
  timestamp: string

}
export interface MigrationsRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataMigrations
  name: string
  timestamp: string

}

interface RequestDataPasswordResets {
  email: string
  token: string
  created_at: string

}
export interface PasswordResetsRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataPasswordResets
  email: string
  token: string
  created_at: string

}

interface RequestDataPasskeys {
  id: number
  cred_public_key: string
  user_id: number
  webauthn_user_id: string
  counter: number
  credential_type: string
  device_type: string
  backup_eligible: boolean
  backup_status: boolean
  transports: string
  created_at: string
  updated_at: string
  last_used_at: string

}
export interface PasskeysRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataPasskeys
  id: number
  cred_public_key: string
  user_id: number
  webauthn_user_id: string
  counter: number
  credential_type: string
  device_type: string
  backup_eligible: boolean
  backup_status: boolean
  transports: string
  created_at: string
  updated_at: string
  last_used_at: string

}

interface RequestDataCommentables {
  id: number
  title: string
  body: string
  status: string
  approved_at: number | null
  rejected_at: number | null
  commentables_id: number
  commentables_type: string
  user_id: number | null
  created_at: string
  updated_at: string | null

}
export interface CommentablesRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataCommentables
  id: number
  title: string
  body: string
  status: string
  approved_at: number | null
  rejected_at: number | null
  commentables_id: number
  commentables_type: string
  user_id: number | null
  created_at: string
  updated_at: string | null

}

interface RequestDataCommentableUpvotes {
  id: number
  user_id: number
  upvoteable_id: number
  upvoteable_type: string
  created_at: string

}
export interface CommentableUpvotesRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataCommentableUpvotes
  id: number
  user_id: number
  upvoteable_id: number
  upvoteable_type: string
  created_at: string

}

interface RequestDataCategorizable {
  id: number
  name: string
  slug: string
  description: string
  is_active: boolean
  categorizable_type: string
  created_at: string
  updated_at: string

}
export interface CategorizableRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataCategorizable
  id: number
  name: string
  slug: string
  description: string
  is_active: boolean
  categorizable_type: string
  created_at: string
  updated_at: string

}

interface RequestDataTaggable {
  id: number
  name: string
  slug: string
  description: string
  is_active: boolean
  taggable_type: string
  created_at: string
  updated_at: string

}
export interface TaggableRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataTaggable
  id: number
  name: string
  slug: string
  description: string
  is_active: boolean
  taggable_type: string
  created_at: string
  updated_at: string

}

interface RequestDataTaggableModels {
  id: number
  tag_id: number
  taggable_id: number
  taggable_type: string
  created_at: string
  updated_at: string | null

}
export interface TaggableModelsRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataTaggableModels
  id: number
  tag_id: number
  taggable_id: number
  taggable_type: string
  created_at: string
  updated_at: string | null

}

interface RequestDataCategorizableModels {
  id: number
  category_id: number
  categorizable_id: number
  categorizable_type: string
  created_at: string
  updated_at: string | null

}
export interface CategorizableModelsRequestType extends Request {
  validate: (attributes?: CustomAttributes) => void
  get: <T = string>(element: string, defaultValue?: T) => T
  all: () => RequestDataCategorizableModels
  id: number
  category_id: number
  categorizable_id: number
  categorizable_type: string
  created_at: string
  updated_at: string | null

}

export type TraitRequest = MigrationsRequestType | PasswordResetsRequestType | PasskeysRequestType | CommentablesRequestType | CommentableUpvotesRequestType | CategorizableRequestType | TaggableRequestType | TaggableModelsRequestType | CategorizableModelsRequestType
