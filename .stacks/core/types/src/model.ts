/**
 * Model.
 */
export interface Model {
  name: string
  searchable?: boolean // | IndexSettings,
  columns: ColumnOptions[]
}

export interface ColumnOptions {
  name: string
  type: 'String' | 'Number' | 'Boolean' | 'Date' | 'Object' | 'Array'
  unique?: boolean
  required?: boolean
  default?: any
  factory?: () => any
  validate?: (value: any) => boolean
  records?: Record<string, any>[];
}
