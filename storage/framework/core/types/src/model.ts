import type { ModelNames, TableNames } from '@stacksjs/types'
import type { VineBoolean, VineNumber, VineString } from '@vinejs/vine'
import type { DeepPartial, Nullable } from '.'
import type { SearchOptions } from './search-engine'

export type Model = Partial<ModelOptions>

export interface BaseRelation {
  foreignKey?: string
  relationName?: string
}

interface Relation<T = string> extends BaseRelation {
  model: T
}

interface HasOne<T = string> extends Array<Relation<T>> {}
interface HasMany<T = string> extends Array<Relation<T>> {}
interface BelongsTo<T = string> extends Array<Relation<T>> {}
interface BelongsToMany<T = string> extends Array<{
  model: T
  firstForeignKey?: string
  secondForeignKey?: string
  pivotTable?: string
} | T> {}

interface HasOneThrough<T = string> extends Array<{
  model: T
  through: T
  foreignKey?: string
  throughForeignKey?: string
  relationName?: string
}> {}

export interface FieldArrayElement {
  entity: string
  charValue?: string | null
  // Add other properties as needed
}

export interface ModelElement {
  field: string
  default: string | number | boolean | Date | undefined | null
  unique: boolean
  fieldArray: FieldArrayElement | null
}

export interface AuthOptions {
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

export type VineType = VineString | VineNumber | VineBoolean | Date | Nullable<any>
export interface SeedOptions {
  count: number
}

type LogAttribute = string

interface ActivityLogOption {
  exclude: LogAttribute[]
  include: LogAttribute[] // default to “*”
  logOnly: LogAttribute[]
}

export interface Relations {
  hasOne?: HasOne<ModelNames> | ModelNames[]
  hasMany?: HasMany<ModelNames> | ModelNames[]
  belongsTo?: BelongsTo<ModelNames> | ModelNames[]
  belongsToMany?: BelongsToMany<ModelNames> | ModelNames[]
}

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
  table?: string // defaults to the lowercase, plural name of the model name (or the name of the model file)
  primaryKey?: string // defaults to `id`
  autoIncrement?: boolean // defaults to true
  dashboard?: {
    highlight?: boolean | number // defaults to undefined
  }

  traits?: {
    useUuid?: boolean // defaults to false
    useTimestamps?: boolean | TimestampOptions // defaults to true
    timestampable?: boolean | TimestampOptions // useTimestamps alias
    useSoftDeletes?: boolean | SoftDeleteOptions // defaults to false
    softDeletable?: boolean | SoftDeleteOptions // useSoftDeletes alias

    useAuth?: boolean | AuthOptions // defaults to false
    authenticatable?: boolean | AuthOptions // useAuth alias
    useSeeder?: boolean | SeedOptions // defaults to a count of 10
    seedable?: boolean | SeedOptions // useSeeder alias
    useSearch?: boolean | SearchOptions // defaults to false
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

  hasOneThrough?: HasOneThrough<ModelNames>

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
  required?: boolean
  hidden?: boolean
  fillable?: boolean
  guarded?: boolean
  factory?: () => any
  validation?: {
    rule: VineType
    message?: ValidatorMessage
  }
  // validation?: String | Number | Boolean | Date
}

export interface AttributesElements {
  [key: string]: Attribute
}

export interface Attributes {
  [key: string]: any
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
