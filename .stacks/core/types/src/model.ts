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
  fields: Field[]
  useSearch?: boolean | SearchIndexSettings
  useSeed?: boolean | SeedOptions
  useTimestamps?: boolean | TimestampOptions
  // useSoftDeletes?: boolean | SoftDeleteOptions
}

export interface Field {
  name: string
  unique?: boolean
  required?: boolean
  factory?: () => any
  validation?: String | Number | Boolean | Date
}
