export const wipSlug = true
// import { slug as slugify } from '@stacksjs/strings'
// import type { ColumnOptions, Model } from '@stacksjs/types'
// import { client as DatabaseClient } from '@stacksjs/database'

// const database = new DatabaseClient()

// export function generateSlug(model: Model, column: string, text: string): string {
//   const field: ColumnOptions | undefined = model.columns.find((f: ColumnOptions) => f.name === column)
//   if (!field)
//     throw new Error(`Invalid column name: ${column}`)

//   const fieldValue = text || ''
//   const slug = slugify(fieldValue, { lower: true })

//   if (field.unique) {
//     let uniqueSlug = slug
//     let count = 0
//     while (model.records.some(record => record[column] === uniqueSlug)) {
//       count++
//       uniqueSlug = `${slug}-${count}`
//     }
//     return uniqueSlug
//   }

//   return slug
// }

// async function addSlugColumn(modelName: string, columnName: string): Promise<void> {
//   const model = (database as any)[modelName]
//   const fields = model._schema.fields

//   const originalField = fields.find((field: any) => field.dbName === columnName)

//   const slugField = {
//     name: `${columnName}_slug`,
//     type: 'String',
//     unique: originalField.unique || false,
//     required: originalField.required || false,
//     default: '',
//   }

//   await database.$executeRaw(`ALTER TABLE "${modelName}" ADD COLUMN "${columnName}_slug" VARCHAR(255)`)

//   const records = await model.findMany()

//   for (const record of records) {
//     const originalValue = record[columnName]
//     const slugValue = slugify(originalValue)
//     await model.update({ where: { id: record.id }, data: { [`${columnName}_slug`]: slugValue } })
//   }
// }

// export {
//   generateSlug as slug,
// }
