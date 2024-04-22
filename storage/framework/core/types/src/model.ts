import type { VineBoolean, VineNumber, VineString } from '@vinejs/vine'
import type { DeepPartial, Nullable, SearchOptions } from '.'

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
    useSearch?: boolean | SearchOptions // defaults to false
    searchable?: boolean | SearchOptions // useSearch alias
    useApi?: boolean | ApiOptions
  }

  attributes: Attributes

  // relationships
  hasOne: {
    model: string
    foreignKey?: string
  }[]
  hasMany: {
    model: string // should be typed as ModelName
    foreignKey?: string
  }[]
  belongsTo: {
    model: string // should be typed as ModelName
    foreignKey?: string
  }[] // belongsTo: 'User'
  belongsToMany: {
    model: string
    firstForeignKey?: string
    secondForeignKey?: string
    pivotTable?: string
  }[]
  hasThrough: {
    model: string // should be typed as ModelName
    through: string
    using: string
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
    rule: VineString | VineNumber | VineBoolean | Date | Nullable<any>
    message: string
  }
  // validation?: String | Number | Boolean | Date
}

export interface Attributes {
  [key: string]: Attribute
}

export type Model = Partial<ModelOptions>
