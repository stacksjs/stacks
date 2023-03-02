import slugify from 'slugify'
import type { Model, ColumnOptions } from '@stacksjs/types'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

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

async function addSlugColumn(modelName: string, columnName: string): Promise<void> {
  const model = (prisma as any)[modelName]
  const fields = model._schema.fields

  const originalField = fields.find((field: any) => field.dbName === columnName)

  const slugField = {
    name: `${columnName}_slug`,
    type: 'String',
    unique: originalField.unique || false,
    required: originalField.required || false,
    default: '',
  }

  await prisma.$executeRaw(`ALTER TABLE "${modelName}" ADD COLUMN "${columnName}_slug" VARCHAR(255)`)

  const records = await model.findMany()

  for (const record of records) {
    const originalValue = record[columnName]
    const slugValue = slugify(originalValue)
    await model.update({ where: { id: record.id }, data: { [`${columnName}_slug`]: slugValue } })
  }
}

export {
  generateSlug as slug
}
