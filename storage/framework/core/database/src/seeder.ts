import { italic, log } from '@stacksjs/cli'
import { db, sql } from '@stacksjs/database'
import { modelTableName } from '@stacksjs/orm'
import { fetchOtherModelRelations } from '@stacksjs/orm'
import { path } from '@stacksjs/path'
import { makeHash } from '@stacksjs/security'

import { fs } from '@stacksjs/storage'
import { singular, snakeCase } from '@stacksjs/strings'
import type { Model, RelationConfig } from '@stacksjs/types'

async function seedModel(name: string, model?: Model) {
  if (model?.traits?.useSeeder === false || model?.traits?.seedable === false) {
    log.info(`Skipping seeding for ${italic(name)}`)
    return
  }

  if (!model) model = (await import(path.userModelsPath(name))) as Model

  const tableName = await modelTableName(model)
  const seedCount =
    typeof model.traits?.useSeeder === 'object' && model.traits?.useSeeder?.count ? model.traits.useSeeder.count : 10

  log.info(`Seeding ${seedCount} records into ${italic(tableName)}`)

  const records = []
  const otherRelations = await fetchOtherModelRelations(model)

  for (let i = 0; i < seedCount; i++) {
    const record: any = {}

    for (const fieldName in model.attributes) {
      const formattedFieldName = snakeCase(fieldName)
      const field = model.attributes[fieldName]

      // Use the factory function if available, otherwise leave the field undefined
      if (formattedFieldName === 'password')
        record[formattedFieldName] = field?.factory ? await makeHash('Test@123', { algorithm: 'bcrypt' }) : undefined
      else record[formattedFieldName] = field?.factory ? field.factory() : undefined
    }

    if (otherRelations?.length) {
      for (let j = 0; j < otherRelations.length; j++) {
        const relationElement = otherRelations[j] as RelationConfig

        if (relationElement.relationship === 'belongsToMany') {
          await seedPivotRelation(relationElement)
        }

        record[relationElement?.foreignKey] = await seedModelRelation(relationElement?.relationModel as string)
      }
    }

    records.push(record)
  }

  // @ts-expect-error todo: we can improve this in the future
  await db.insertInto(tableName).values(records).execute()
}

async function seedPivotRelation(relation: RelationConfig): Promise<any> {
  const record: any = {}
  const record2: any = {}
  const pivotRecord: any = {}

  const modelInstance = (await import(path.userModelsPath(relation?.model))).default
  const relationModelInstance = (await import(path.userModelsPath(relation?.relationModel))).default

  if (!relationModelInstance) return 1

  const relationModelTable = relationModelInstance.table
  const relationTable = relation.table
  const pivotTable = relation.pivotTable
  const modelKey = `${singular(relationTable)}_id`
  const foreignKey = relation.foreignKey

  for (const fieldName in relationModelInstance.attributes) {
    const formattedFieldName = snakeCase(fieldName)
    const field = relationModelInstance.attributes[fieldName]
    // Use the factory function if available, otherwise leave the field undefined
    if (formattedFieldName === 'password')
      record[formattedFieldName] = field?.factory ? await makeHash('Test@123', { algorithm: 'bcrypt' }) : undefined
    else record[formattedFieldName] = field?.factory ? field.factory() : undefined
  }

  for (const fieldName in modelInstance.attributes) {
    const formattedFieldName = snakeCase(fieldName)
    const field = modelInstance.attributes[fieldName]
    // Use the factory function if available, otherwise leave the field undefined
    if (formattedFieldName === 'password')
      record2[formattedFieldName] = field?.factory ? await makeHash('Test@123', { algorithm: 'bcrypt' }) : undefined
    else record2[formattedFieldName] = field?.factory ? field.factory() : undefined
  }

  const data = await db.insertInto(relationModelTable).values(record).executeTakeFirstOrThrow()
  const data2 = await db.insertInto(relationTable).values(record2).executeTakeFirstOrThrow()
  const relationData = data.insertId || 1
  const modelData = data2.insertId || 1

  pivotRecord[foreignKey] = relationData
  pivotRecord[modelKey] = modelData

  if (pivotTable) await db.insertInto(pivotTable).values(pivotRecord).executeTakeFirstOrThrow()
}

async function seedModelRelation(modelName: string): Promise<BigInt | number> {
  const modelInstance = (await import(path.userModelsPath(modelName))).default

  if (!modelInstance) return 1

  const record: any = {}
  const table = modelInstance.table

  for (const fieldName in modelInstance.attributes) {
    const formattedFieldName = snakeCase(fieldName)
    const field = modelInstance.attributes[fieldName]
    // Use the factory function if available, otherwise leave the field undefined

    if (formattedFieldName === 'password')
      record[formattedFieldName] = field?.factory ? await makeHash(field.factory(), { algorithm: 'bcrypt' }) : undefined
    else record[formattedFieldName] = field?.factory ? field.factory() : undefined
  }

  const data = await db.insertInto(table).values(record).executeTakeFirstOrThrow()

  return data.insertId || 1
}

export async function seed() {
  // TODO: need to check other databases too
  // const dbPath = path.userDatabasePath('stacks.sqlite')

  // if (!fs.existsSync(dbPath)) {
  //   log.warn('No database found, configuring it...')
  //   // first, ensure the database is reset
  //   await resetDatabase()

  //   // then, generate the migrations
  //   await generateMigrations()

  //   // finally, migrate the database
  //   await runDatabaseMigration()
  // } else {
  //   log.debug('Database configured...')
  // }

  // if a custom seeder exists, use it instead
  const customSeederPath = path.userDatabasePath('seeder.ts')
  if (fs.existsSync(customSeederPath)) {
    log.info('Custom seeder found')
    await import(customSeederPath)
  }

  // otherwise, seed all models
  const modelsDir = path.userModelsPath()
  const modelFiles = fs.readdirSync(modelsDir).filter((file) => file.endsWith('.ts'))

  for (const file of modelFiles) {
    const modelPath = path.join(modelsDir, file)
    const model = await import(modelPath)
    await seedModel(file, model.default)
  }
}
