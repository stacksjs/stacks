import type { Model } from '@stacksjs/types'
import { italic, log } from '@stacksjs/cli'
import { db } from '@stacksjs/database'
import { faker } from '@stacksjs/faker'
import { findCoreModel, getModelName, getTableName } from '@stacksjs/orm'
import { path } from '@stacksjs/path'
import { makeHash } from '@stacksjs/security'
import { fs } from '@stacksjs/storage'
import { snakeCase } from '@stacksjs/strings'
import { globSync } from 'tinyglobby'

async function seedModel(name: string, modelPath: string, model: Model) {
  if (model?.traits?.useSeeder === false || model?.traits?.seedable === false) {
    log.info(`Skipping seeding for ${italic(name)}`)
    return
  }

  if (
    typeof model?.traits === 'object'
    && model?.traits !== undefined
    && !('useSeeder' in model.traits)
  ) {
    log.info(`Skipping seeding for ${italic(name)}`)
    return
  }

  const tableName = await getTableName(model, modelPath)

  const seedCount
    = typeof model.traits?.useSeeder === 'object' && model.traits?.useSeeder?.count ? model.traits.useSeeder.count : 10

  log.info(`Seeding ${seedCount} records into ${italic(tableName)}`)

  const modelName = getModelName(model, modelPath)

  // const otherRelations = await fetchOtherModelRelations(modelName)

  const modelInstance = await getModelInstance(modelName)

  const useUuid = modelInstance?.traits?.useUuid || false

  for (let i = 0; i < seedCount; i++) {
    const record: Record<string, any> = {}

    for (const fieldName in model.attributes) {
      const formattedFieldName = snakeCase(fieldName)
      const field = model.attributes[fieldName]

      // Pass faker to the factory function
      if (formattedFieldName === 'password') {
        record[formattedFieldName] = field?.factory ? await makeHash(field.factory(faker), { algorithm: 'bcrypt' }) : undefined
      }
      else {
        record[formattedFieldName] = field?.factory ? field.factory(faker) : undefined
      }
    }

    // if (otherRelations?.length) {
    //   for (let j = 0; j < otherRelations.length; j++) {
    //     const relationElement = otherRelations[j] as RelationConfig

    //     const relationType = getRelationType(relationElement.relationship)

    //     if (relationElement.relationship === 'belongsToMany') {
    //       await seedPivotRelation(relationElement)
    //     }

    //     if (relationType === 'hasType')
    //       record[relationElement?.foreignKey] = await seedModelRelation(relationElement?.relationModel as string)
    //   }
    // }

    if (useUuid)
      record.uuid = Bun.randomUUIDv7()

    if (Object.keys(record).length > 0)
      await db.insertInto(tableName).values(record).executeTakeFirstOrThrow()
  }

  log.info(`Successfully seeded ${italic(tableName)}`)
}

// async function seedPivotRelation(relation: RelationConfig): Promise<any> {
//   const record: Record<string, any> = {}
//   const record2: Record<string, any> = {}
//   const pivotRecord: Record<string, any> = {}
//   const modelInstance = await getModelInstance(relation?.model)

//   const relationModelInstance = (await import(path.userModelsPath(`${relation?.relationModel}.ts`))).default

//   const useUuid = modelInstance?.traits?.useUuid || false

//   if (!relationModelInstance)
//     return 1

//   const relationModelTable = relationModelInstance.table
//   const relationalModelUuid = relationModelInstance.traits?.useUuid || false
//   const relationTable = relation.table
//   const pivotTable = relation.pivotTable
//   const modelKey = relation.pivotForeign || ''
//   const foreignKey = relation.pivotKey || ''

//   for (const fieldName in relationModelInstance.attributes) {
//     const formattedFieldName = snakeCase(fieldName)
//     const field = relationModelInstance.attributes[fieldName]
//     // Pass faker to the factory function
//     if (formattedFieldName === 'password')
//       record[formattedFieldName] = field?.factory ? await makeHash(field.factory(faker), { algorithm: 'bcrypt' }) : undefined
//     else
//       record[formattedFieldName] = field?.factory ? field.factory(faker) : undefined
//   }

//   for (const fieldName in modelInstance.attributes) {
//     const formattedFieldName = snakeCase(fieldName)
//     const field = modelInstance.attributes[fieldName]
//     // Pass faker to the factory function
//     if (formattedFieldName === 'password')
//       record2[formattedFieldName] = field?.factory ? await makeHash(field.factory(faker), { algorithm: 'bcrypt' }) : undefined
//     else record2[formattedFieldName] = field?.factory ? field.factory(faker) : undefined
//   }

//   if (relationalModelUuid)
//     record.uuid = Bun.randomUUIDv7()

//   const data = await db.insertInto(relationModelTable).values(record).executeTakeFirstOrThrow()

//   if (useUuid)
//     record2.uuid = Bun.randomUUIDv7()

//   const data2 = await db.insertInto(relationTable).values(record2).executeTakeFirstOrThrow()
//   const relationData = data.insertId || 1
//   const modelData = data2.insertId || 1

//   pivotRecord[foreignKey] = relationData
//   pivotRecord[modelKey] = modelData

//   if (useUuid)
//     pivotRecord.uuid = Bun.randomUUIDv7()

//   if (pivotTable)
//     await db.insertInto(pivotTable).values(pivotRecord).executeTakeFirstOrThrow()
// }

async function getModelInstance(modelName: string): Promise<Model> {
  let modelInstance: Model
  let currentPath = path.userModelsPath(`${modelName}.ts`)

  if (fs.existsSync(currentPath)) {
    modelInstance = (await import(path.userModelsPath(`${modelName}.ts`))).default as Model
  }
  else {
    currentPath = findCoreModel(`${modelName}.ts`)

    modelInstance = (await import(currentPath)).default as Model
  }

  return modelInstance
}

// async function seedModelRelation(modelName: string): Promise<bigint | number> {
//   let modelInstance: Model
//   let currentPath = path.userModelsPath(`${modelName}.ts`)

//   if (fs.existsSync(currentPath)) {
//     modelInstance = (await import(path.userModelsPath(`${modelName}.ts`))).default as Model
//   }
//   else {
//     currentPath = findCoreModel(`${modelName}.ts`)
//     modelInstance = (await import(currentPath)).default as Model
//   }

//   if (modelInstance === null || modelInstance === undefined)
//     return 1

//   const record: any = {}
//   const tableName = getTableName(modelInstance, currentPath)

//   const useUuid = modelInstance.traits?.useUuid || false

//   for (const fieldName in modelInstance.attributes) {
//     const formattedFieldName = snakeCase(fieldName)
//     const field = modelInstance.attributes[fieldName]
//     // Pass faker to the factory function
//     if (formattedFieldName === 'password')
//       record[formattedFieldName] = field?.factory ? await makeHash(field.factory(faker), { algorithm: 'bcrypt' }) : undefined
//     else record[formattedFieldName] = field?.factory ? field.factory(faker) : undefined
//   }

//   if (useUuid)
//     record.uuid = Bun.randomUUIDv7()

//   const data = await db.insertInto(tableName).values(record).executeTakeFirstOrThrow()

//   return (Number(data.insertId) || Number(data.numInsertedOrUpdatedRows)) || 1
// }

export async function seed(): Promise<void> {
  // if a custom seeder exists, use it instead
  const customSeederPath = path.userDatabasePath('seeder.ts')
  if (fs.existsSync(customSeederPath)) {
    log.info('Custom seeder found')
    await import(customSeederPath)
  }

  // Recursively find all .ts model files
  const modelsDir = path.userModelsPath()
  const coreModelsDir = path.storagePath('framework/defaults/models')

  // Use glob to find all .ts files recursively in core models
  const coreModelFiles = globSync(`${coreModelsDir}/**/*.ts`, { absolute: true })

  // Original user models seeding
  const modelFiles = fs.readdirSync(modelsDir).filter(file => file.endsWith('.ts'))

  // Seed user models (keeping original implementation)
  for (const file of modelFiles) {
    const modelPath = path.join(modelsDir, file)
    const model = await import(modelPath)

    await seedModel(file, modelPath, model.default)
  }

  // Seed core models with recursive file finding
  for (const coreModelPath of coreModelFiles) {
    const modelCore = await import(coreModelPath)

    await seedModel(path.basename(coreModelPath), coreModelPath, modelCore.default)
  }
}
