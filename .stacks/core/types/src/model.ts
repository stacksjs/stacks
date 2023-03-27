import type { ZodBoolean as Boolean, ZodDate as Date, ZodNumber as Number, ZodString as String } from 'zod'
import type { SearchIndexSettings } from 'stacks/core/types/src'

export interface SeedOptions {
  count: number
}

export interface TimestampOptions {
  createdAt?: string // defaults to 'created_at'
  updatedAt?: string
  deletedAt?: string
}

/**
 * Model.
 */
export interface Model {
  name?: string // defaults to the file name of the model
  fields: Fields
  hasOne?: string
  hasMany?: string
  belongsToMany?: string
  hasThrough?: {
    model: string
    through: string
    using: string
  }
  seedable?: boolean | SeedOptions
  useSeed?: boolean | SeedOptions
  searchable?: boolean | SearchIndexSettings
  useSearch?: boolean | SearchIndexSettings
  useTimestamps?: boolean | TimestampOptions
  // useSoftDeletes?: boolean | SoftDeleteOptions
}

export interface Fields {
  [key: string]: {
    type: string
    default?: boolean
    unique?: boolean
    required?: boolean
    factory?: () => any
    validation?: String | Number | Boolean | Date
  }
}
