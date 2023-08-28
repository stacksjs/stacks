import { type VineBoolean, type VineNumber, type VineString } from '@vinejs/vine'
import { type Nullable, type SearchEngineSettings } from './'

export interface AuthOptions {}

export interface SeedOptions {
  count: number
}

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
  useUuid: boolean
  fields: Fields
  hasOne: string // hasOne: 'Post
  hasMany: {
    model: string // should be typed as ModelName
    foreignKey: string
  }
  belongsToMany: {}
  hasThrough: {
    model: string // should be typed as ModelName
    through: string
    using: string
  }
  authenticatable: boolean | AuthOptions
  seedable: boolean | SeedOptions
  searchable: boolean | SearchEngineSettings
  useSeed: boolean | SeedOptions
  useSearch: boolean | SearchEngineSettings
  useSearchEngine: boolean | SearchEngineSettings
  useTimestamps: boolean | TimestampOptions
  useSoftDeletes: boolean | SoftDeleteOptions

  attributes: {
    [key: string]: {
      get: (value: any) => any
      set: (value: any) => any
    }
  }
}

export interface Fields {
  [key: string]: {
    default?: boolean
    unique?: boolean
    required?: boolean
    factory?: () => any
    validator?: {
      rule: VineString | VineNumber | VineBoolean | Date | Nullable<any>
      message: string
    }
    // validation?: String | Number | Boolean | Date
  }
}

export type Model = Partial<ModelOptions>
