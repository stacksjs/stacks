import { path } from '@stacksjs/path'
import { db } from '@stacksjs/database'
import { fs } from '@stacksjs/storage'

async function seedModel(model: any) {
  const tableName = model.table
  const seedCount = model.traits.useSeeder?.count || 10 // Default to 10 if not specified
  const records = []

  for (let i = 0; i < seedCount; i++) {
    const record: any = {}
    for (const fieldName in model.fields) {
      const field = model.fields[fieldName]
      // Use the factory function if available, otherwise leave the field undefined
      record[fieldName] = field.factory ? field.factory() : undefined
    }
    records.push(record)
  }

  await db.insertInto(tableName).values(records).execute()
}

export async function seed() {
  const modelsDir = path.userModelsPath()
  const modelFiles = fs.readdirSync(modelsDir).filter(file => file.endsWith('.ts'))

  for (const file of modelFiles) {
    const modelPath = path.join(modelsDir, file)
    const model = await import(modelPath)
    await seedModel(model.default)
  }
}
