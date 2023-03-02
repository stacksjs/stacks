import slugify from 'slugify'
import type { Model, ColumnOptions } from '@stacksjs/types'

export function generateSlug(model: Model, column: string, text: string): string {
  // Find the field that corresponds to the given column name
  const field: ColumnOptions | undefined = model.columns.find((f: ColumnOptions) => f.name === column)
  if (!field) {
    throw new Error(`Invalid column name: ${column}`)
  }

  const fieldValue = text || ''
  const slug = slugify(fieldValue, { lower: true })

  if (field.unique) {
    let uniqueSlug = slug
    let count = 0
    while (model.records.some((record) => record[column] === uniqueSlug)) {
      count++
      uniqueSlug = `${slug}-${count}`
    }
    return uniqueSlug
  }

  return slug
}

export {
  generateSlug as slug
}
