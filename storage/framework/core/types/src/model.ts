import type { VineBoolean, VineNumber, VineString } from '@vinejs/vine'
import type { DeepPartial, Nullable, SearchEngineSettings } from '.'

export interface AuthOptions {}

export interface SeedOptions {
  count: number
}

export interface ApiSettings {
  uri: string
  middleware: string[]
  routes: {
    index: boolean
    show: boolean
    store: boolean
    update: boolean
    destroy: boolean
  }
}

type ApiOptions = DeepPartial<ApiSettings>

export interface TimestampOptions {
  createdAt?: string // defaults to 'created_at'
  updatedAt?: string
  deletedAt?: string
}

export interface SoftDeleteOptions {
  deletedAt?: string // defaults to 'deleted_at' & can be used for localized tables
}

interface Base {}

/**
 * Model.
 */
export interface ModelOptions extends Base {
  name: string // defaults to the file name of the model
  table: string // defaults to the lowercase, plural name of the model
  primaryKey?: string // defaults to `id`
  autoIncrement?: boolean // defaults to true

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
    useSearch?: boolean | SearchEngineSettings // defaults to false
    searchable?: boolean | SearchEngineSettings // useSearch alias
    useApi?: boolean | ApiOptions
  }

  fields: Fields

  // relationships
  hasOne: string // hasOne: 'Post'
  hasMany: {
    model: string // should be typed as ModelName
    foreignKey?: string
  }
  belongsTo: string // belongsTo: 'User'
  belongsToMany: object
  hasThrough: {
    model: string // should be typed as ModelName
    through: string
    using: string
  }

  attributes: {
    [key: string]: {
      get: (value: any) => any
      set: (value: any) => any
    }
  }

  get: {
    [key: string]: (value: any) => any
  }

  set: {
    [key: string]: (value: any) => any
  }
}

export interface FieldOptions {
  default?: string | number | boolean | Date
  unique?: boolean
  required?: boolean
  factory?: () => any
  validator?: {
    rule: VineString | VineNumber | VineBoolean | Date | Nullable<any>
    message: string
  }
  // validation?: String | Number | Boolean | Date
}

export interface Fields {
  [key: string]: FieldOptions
}

export type Model = Partial<ModelOptions>
