import type { ModelNames, Model as ModelType } from '@stacksjs/types'
import type { VineBoolean, VineNumber, VineString } from '@vinejs/vine'
import type { DeepPartial, Nullable, SearchOptions } from '.'

export type AuthOptions = {}

export type ApiRoutes = 'index' | 'show' | 'store' | 'update' | 'destroy'

export type VineType = VineString | VineNumber | VineBoolean | Date | Nullable<any>
export interface SeedOptions {
  count: number
}

export interface ApiSettings {
  uri: string
  middleware: string[]
  routes: ApiRoutes[]
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

type Base = {}

/**
 * Model.
 */
export interface ModelOptions extends Base {
  name: string // defaults to the file name of the model
  table: string // defaults to the lowercase, plural name of the model name (or the name of the model file)
  primaryKey?: string // defaults to `id`
  autoIncrement?: boolean // defaults to true
  dashboard?: {
    highlight?: boolean | number // defaults to undefined
  }

  traits: {
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
    useApi?: boolean | ApiOptions
  }

  attributes: Attributes

  // relationships
  hasOne:
    | {
        model: ModelNames
        foreignKey?: string
        relationName?: string
      }[]
    | string[]
  hasMany:
    | {
        model: ModelNames // should be typed as ModelName
        foreignKey?: string
        relationName?: string
      }[]
    | ModelNames[]
  belongsTo:
    | {
        model: ModelNames // should be typed as ModelName
        foreignKey?: string
        relationName?: string
      }[]
    | ModelNames[] // belongsTo: 'User'
  belongsToMany:
    | {
        model: ModelNames
        firstForeignKey?: string
        secondForeignKey?: string
        pivotTable?: string
        relationName?: string
      }
    | ModelNames[]
  hasOneThrough: {
    model: ModelNames
    through: ModelNames
    foreignKey?: string
    throughForeignKey?: string
    relationName?: string
  }[]

  get: {
    [key: string]: (value: any) => any
  }

  set: {
    [key: string]: (value: any) => any
  }
}

export interface Attribute {
  default?: string | number | boolean | Date
  unique?: boolean
  required?: boolean
  factory?: () => any
  validator?: {
    rule: VineType
    message: ValidatorMessage
  }
  // validation?: String | Number | Boolean | Date
}

export interface Attributes {
  [key: string]: Attribute
}

export type Model = Partial<ModelOptions>

export interface RelationConfig {
  relationship: string
  model: string
  table?: string
  relationModel?: string
  relationTable?: string
  foreignKey: string
  relationName: string
  throughModel: string
  throughForeignKey: string
  pivotTable: string
}
