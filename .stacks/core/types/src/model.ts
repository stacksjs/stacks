import type { ZodBoolean as Boolean, ZodDate as Date, ZodNumber as Number, ZodString as String } from 'zod'
import type { SearchIndexSettings } from 'stacks/core/types/src'

export interface SeedOptions {
  count: number
}

/**
 * Model.
 */
export interface Model {
  name: string
  searchable?: boolean | SearchIndexSettings
  seedable?: boolean | SeedOptions
  fields: Field[]
  usesTimestamps?: boolean
}

export interface Field {
  name: string
  unique?: boolean
  required?: boolean
  factory?: () => any
  validation?: String | Number | Boolean | Date
}
