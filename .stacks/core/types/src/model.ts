import type {
  VineBoolean as Boolean,
  VineNumber as Number,
  VineString as String,
} from '@vinejs/vine'
import type { Nullable, SearchIndexSettings } from './'

export interface AuthOptions {}

export interface SeedOptions {
  count: number
}

export interface TimestampOptions {
  createdAt?: string // defaults to 'created_at'
  updatedAt?: string
  deletedAt?: string
}

interface Base {}

/**
 * Model.
 */
export interface Model extends Base {
  name?: string // defaults to the file name of the model
  table?: string // defaults to the lowercase, plural name of the model
  fields: Fields
  hasOne?: string
  hasMany?: string
  belongsToMany?: string
  hasThrough?: {
    model: string // should be typed as ModelName
    through: string
    using: string
  }
  authenticatable?: boolean | AuthOptions
  seedable?: boolean | SeedOptions
  searchable?: boolean | SearchIndexSettings
  useSeed?: boolean | SeedOptions
  useSearch?: boolean | SearchIndexSettings
  useSearchEngine?: boolean | SearchIndexSettings
  useTimestamps?: boolean | TimestampOptions
  // useSoftDeletes?: boolean | SoftDeleteOptions
}

export interface Fields {
  [key: string]: {
    default?: boolean
    unique?: boolean
    required?: boolean
    factory?: () => any
    validator?: {
      rule: String | Number | Boolean | Date | Nullable<any>
      message: string
    }
    // validation?: String | Number | Boolean | Date
  }
}
