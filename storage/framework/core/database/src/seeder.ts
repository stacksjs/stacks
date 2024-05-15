import { italic, log } from '@stacksjs/cli'
import { db } from '@stacksjs/database'
import { path } from '@stacksjs/path'
import { fs, glob } from '@stacksjs/storage'
import { isString } from '@stacksjs/validation'
import { snakeCase } from '@stacksjs/strings'
import type { Model, RelationConfig } from '@stacksjs/types'
import { generateMigrations, resetDatabase, runDatabaseMigration } from './migrations'

async function seedModel(name: string, model?: Model) {
  if (model?.traits?.useSeeder === false || model?.traits?.seedable === false) {
    log.info(`Skipping seeding for ${italic(name)}`)
    return
  }

  if (!model) model = (await import(path.userModelsPath(name))) as Model

  const tableName = model.table ?? snakeCase(model.name ?? name.replace('.ts', ''))
  const seedCount =
    typeof model.traits?.useSeeder === 'object' && model.traits?.useSeeder?.count ? model.traits.useSeeder.count : 10
  log.info(`Seeding ${seedCount} records into ${italic(tableName)}`)
  const records = []

  const otherRelations = await fetchOtherModelRelations(model)

  console.log(otherRelations)
  
  for (let i = 0; i < seedCount; i++) {
    const record: any = {}
    for (const fieldName in model.attributes) {
      const field = model.attributes[fieldName]
      // Use the factory function if available, otherwise leave the field undefined
      record[fieldName] = field?.factory ? field.factory() : undefined
    }

    if (otherRelations?.length) {
      for (let j = 0; j < otherRelations.length; j++) {
        const relationElement = otherRelations[j] as RelationConfig

        record[relationElement?.foreignKey] = 1 // TODO: make this dynamic
      }
    }

    records.push(record)
  }

  // @ts-expect-error todo: we can improve this in the future
  await db.insertInto(tableName).values(records).execute()
}

export async function getRelations(model: Model): Promise<RelationConfig[]> {
  const relationsArray = ['hasOne', 'hasMany', 'belongsToMany', 'hasOneThrough']
  const relationships = []

  for (const relation of relationsArray) {
    if (hasRelations(model, relation)) {
      for (const relationInstance of model[relation]) {
        let relationModel = relationInstance.model

        if (isString(relationInstance)) {
          relationModel = relationInstance
        }

        const modelRelationPath = path.userModelsPath(`${relationModel}.ts`)
        const modelRelation = (await import(modelRelationPath)).default
        const formattedModelName = model.name.toLowerCase()

        relationships.push({
          relationship: relation,
          model: relationModel,
          table: modelRelation.table,
          relationModel: model.name,
          relationTable: model.table,
          foreignKey: relationInstance.foreignKey || `${formattedModelName}_id`,
          relationName: relationInstance.relationName || '',
          throughModel: relationInstance.through || '',
          throughForeignKey: relationInstance.throughForeignKey || '',
          pivotTable: relationInstance?.pivotTable || `${formattedModelName}_${modelRelation.table}`,
        })
      }
    }
  }

  return relationships
}

export async function fetchOtherModelRelations(model: Model) {

  const modelFiles = glob.sync(path.userModelsPath('*.ts'))

  const modelRelations = []

  for (let i = 0; i < modelFiles.length; i++) {
    const modelFileElement = modelFiles[i] as string

    const modelFile = await import(modelFileElement)

    if (model.name === modelFile.default.name) continue

    const relations = await getRelations(modelFile.default)

    if (! relations.length) continue

    const relation = relations.find(relation => relation.model === model.name)

    if (relation)
      modelRelations.push(relation)

    return modelRelations
  }
}

function hasRelations(obj: any, key: string): boolean {
  return key in obj
}

export async function seed() {
  // TODO: need to check other databases too
  const dbPath = path.userDatabasePath('stacks.sqlite')
  if (!fs.existsSync(dbPath)) {
    log.warn('No database found, configuring it...')
    await resetDatabase()

    // generate the migrations
    await generateMigrations()

    // migrate the database
    await runDatabaseMigration()
  } else {
    log.debug('Database configured...')
  }

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
