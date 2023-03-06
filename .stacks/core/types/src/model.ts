/**
 * Model.
 */
export interface Model {
  name: string
  searchable?: boolean // | IndexSettings,
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
  validate?: (value: any) => boolean
}

export interface ColumnOptions {
  name: string
  type: 'String' | 'Number' | 'Boolean' | 'Date' | 'Object' | 'Array'
  unique?: boolean
  required?: boolean
  default?: any
  factory?: () => any
  validate?: (value: any) => boolean
  records?: Record<string, any>[]
}
