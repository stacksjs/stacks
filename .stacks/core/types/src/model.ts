import type { ZodBoolean as Boolean, ZodDate as Date, ZodNumber as Number, ZodString as String } from 'zod'
import type { Settings as IndexSettings } from 'stacks/core/types/src'

/**
 * Model.
 */
export interface Model {
  name: string
  searchable?: boolean | IndexSettings
  seeder?: {
    count: number
  }
  fields: Field[]
}

export interface Field {
  name: string
  unique?: boolean
  required?: boolean
  factory?: () => any
  validation?: String | Number | Boolean | Date
}
