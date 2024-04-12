import { path } from '@stacksjs/path'
import { db } from '@stacksjs/database'
import { italic, log } from '@stacksjs/cli'
import { fs } from '@stacksjs/storage'
import { snakeCase } from '@stacksjs/strings'
import type { Model } from '@stacksjs/types'

async function seedModel(name: string, model?: Model) {
  if (model?.traits?.useSeeder === false || model?.traits?.seedable === false) {
    log.info(`Skipping seeding for ${italic(name)}`)
    return
  }

  if (!model)
    model = await import(path.userModelsPath(name))

  const tableName = model!.table ?? snakeCase(model!.name ?? name.replace('.ts', ''))
  const seedCount = typeof model!.traits?.useSeeder === 'object' && model!.traits?.useSeeder?.count ? model!.traits.useSeeder.count : 10
  log.info(`Seeding ${seedCount} records into ${italic(tableName)}`)
  const records = []

  for (let i = 0; i < seedCount; i++) {
    const record: any = {}
    for (const fieldName in model!.attributes) {
      const field = model!.attributes[fieldName]
      // Use the factory function if available, otherwise leave the field undefined
      record[fieldName] = field?.factory ? field.factory() : undefined
    }
    records.push(record)
  }

  // @ts-expect-error todo: we can improve this in the future
  await db.insertInto(tableName).values(records).execute()
}

export async function seed() {
  // if a custom seeder exists, use it instead
  const customSeederPath = path.userDatabasePath('seeder.ts')
  if (fs.existsSync(customSeederPath)) {
    log.info('Custom seeder found')
    await import(customSeederPath)
  }

  // otherwise, seed all models
  const modelsDir = path.userModelsPath()
  const modelFiles = fs.readdirSync(modelsDir).filter(file => file.endsWith('.ts'))

  for (const file of modelFiles) {
    const modelPath = path.join(modelsDir, file)
    const model = await import(modelPath)
    await seedModel(file, model.default)
  }
}
