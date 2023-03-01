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
  type: string
  required?: boolean
  unique?: boolean
  default?: string
}
