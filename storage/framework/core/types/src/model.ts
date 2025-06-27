import type { Faker } from '@stacksjs/faker'
import type { ValidationType } from '@stacksjs/ts-validation'
import type { ModelNames, TableNames } from '@stacksjs/types'
import type { DeepPartial } from '.'
import type { SearchOptions } from './search-engine'

export type Model = Partial<ModelOptions>

export interface BaseRelation {
  foreignKey?: string
  relationName?: string
}

export interface Relation<T = string> extends BaseRelation {
  model: T
}

export interface HasOne<T = string> extends Array<Relation<T>> {}

export interface MorphTo {
  name: string
}

export interface MorphOne<T = string> extends BaseRelation {
  model: T
  morphName?: string
  type?: string
  id?: string
}

export interface MorphMany<T = string> extends MorphOne<T> {}

export interface HasMany<T = string> extends Array<Relation<T>> {}
export interface BelongsTo<T = string> extends Array<Relation<T>> {}

export interface BelongsToMany<T = string> extends Array<BaseBelongsToMany<T> | T> {}
export interface HasOneThrough<T = string> extends Array<BaseHasOneThrough<T> | T> {}

export interface BaseBelongsToMany<T = string> {
  model: T
  firstForeignKey?: string
  secondForeignKey?: string
  pivotTable?: string
}

export interface BaseHasOneThrough<T = string> {
  model: T
  through: T
  foreignKey?: string
  throughForeignKey?: string
  relationName?: string
}

export interface FieldArrayElement {
  entity: string
  charValue?: string | null
  // Add other properties as needed
}

export interface ModelElement {
  field: string
  default: string | number | boolean | Date | undefined | null
  unique: boolean
  fillable: boolean
  hidden: boolean
  required: boolean
  fieldArray: FieldArrayElement | null
}

export interface UserAuthOptions {
  useTwoFactor?: boolean
  usePasskey?: boolean
}
export interface LikeableOptions {
  table?: string
  foreignKey?: string
}

type ActionPath = string
type ActionName = string
type Action = ActionPath | ActionName | undefined

export type ApiRoutes = 'index' | 'show' | 'store' | 'update' | 'destroy'

export type SocialProviders = 'google' | 'github' | 'twitter' | 'facebook'

export interface SeedOptions {
  count: number
}

type LogAttribute = string

interface ActivityLogOption {
  exclude: LogAttribute[]
  include: LogAttribute[] // default to "*"
  logOnly: LogAttribute[]
}

export interface Relations {
  hasOne: HasOne<ModelNames> | ModelNames[]
  hasMany: HasMany<ModelNames> | ModelNames[]
  belongsTo: BelongsTo<ModelNames> | ModelNames[]
  belongsToMany: BelongsToMany<ModelNames> | ModelNames[]
}

export type SocialOptions = SocialProviders[]

export interface ApiSettings {
  uri: string
  middleware: string[]
  routes:
    | {
      [key in ApiRoutes]: Action
    }
    | string[]
  openApi: boolean
}

type ApiOptions = DeepPartial<ApiSettings>

export interface TimestampOptions {
  createdAt?: string // defaults to 'created_at'
  updatedAt?: string
  deletedAt?: string
}

interface ValidatorMessage {
  [key: string]: string
}

export interface SoftDeleteOptions {
  deletedAt?: string // defaults to 'deleted_at' & can be used for localized tables
}

interface Base {}

/**
 * Model.
 */
export interface ModelOptions extends Base {
  /**
   * The name of the model.
   *
   * @default string - The file name of the model.
   */
  name: string // defaults to the file name of the model
  description?: string // defaults to the file name of the model
  table?: string // defaults to the lowercase, plural name of the model name (or the name of the model file)
  primaryKey?: string // defaults to `id`
  autoIncrement?: boolean // defaults to true
  indexes?: CompositeIndex[]
  dashboard?: {
    highlight?: boolean | number // defaults to undefined
  }

  traits?: {
    useUuid?: boolean // defaults to false
    useTimestamps?: boolean | TimestampOptions // defaults to true
    timestampable?: boolean | TimestampOptions // useTimestamps alias
    useSoftDeletes?: boolean | SoftDeleteOptions // defaults to false
    softDeletable?: boolean | SoftDeleteOptions // useSoftDeletes alias
    categorizable?: boolean // defaults to false
    taggable?: boolean // defaults to false
    commentables?: boolean // defaults to false
    useAuth?: boolean | UserAuthOptions // defaults to false
    authenticatable?: boolean | UserAuthOptions // useAuth alias
    useSeeder?: boolean | SeedOptions // defaults to a count of 10
    seedable?: boolean | SeedOptions // useSeeder alias
    useSearch?: boolean | SearchOptions // defaults to false
    useSocials?: SocialOptions // defaults to false
    searchable?: boolean | SearchOptions // useSearch alias
    useApi?: ApiOptions | boolean
    observe?: string[] | boolean
    billable?: boolean
    useActivityLog?: boolean | ActivityLogOption

    likeable?: boolean | LikeableOptions
  }

  attributes?: AttributesElements

  // relationships
  hasOne?: HasOne<ModelNames> | ModelNames[]

  hasMany?: HasMany<ModelNames> | ModelNames[]

  belongsTo?: BelongsTo<ModelNames> | ModelNames[]

  belongsToMany?: BelongsToMany<ModelNames> | ModelNames[]

  hasOneThrough?: HasOneThrough<ModelNames> | ModelNames[]

  morphOne?: MorphOne<ModelNames> | ModelNames

  morphMany?: MorphMany<ModelNames>[] | ModelNames[]

  morphTo?: MorphTo

  scopes?: {
    [key: string]: (value: any) => any
  }

  get?: {
    [key: string]: (value: any) => any
  }

  set?: {
    [key: string]: (value: any) => any
  }
}

export interface Attribute {
  default?: string | number | boolean | Date
  unique?: boolean
  order?: number
  hidden?: boolean
  fillable?: boolean
  guarded?: boolean
  factory?: (faker: Faker) => any
  validation: {
    rule: ValidationType
    message?: ValidatorMessage
  }
}

export interface CompositeIndex {
  name: string
  columns: string[]
}

export interface AttributesElements {
  [key: string]: Attribute
}

export interface RelationConfig {
  relationship: string
  model: string
  table: TableNames
  relationModel?: string
  relationTable?: string
  foreignKey: string
  modelKey: string
  pivotKey?: string
  pivotForeign?: string
  relationName?: string
  throughModel?: string
  throughForeignKey?: string
  pivotTable: TableNames
}
