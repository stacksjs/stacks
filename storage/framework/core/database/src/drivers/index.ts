import { log } from '@stacksjs/cli'
import { db } from '@stacksjs/database'
import { path } from '@stacksjs/path'
import { fs, glob } from '@stacksjs/storage'
import { plural, snakeCase } from '@stacksjs/strings'
import type { Attributes, Model, RelationConfig, VineType } from '@stacksjs/types'
import { isString } from '@stacksjs/validation'

export * from './mysql'
export * from './postgres'
export * from './sqlite'

export async function getLastMigrationFields(modelName: string): Promise<Attributes> {
  const oldModelPath = path.frameworkPath(`database/models/${modelName}`)
  const model = (await import(oldModelPath)).default as Model
  let fields = {} as Attributes

  if (typeof model.attributes === 'object') fields = model.attributes
  else fields = JSON.parse(model.attributes) as Attributes

  return fields
}

export async function modelTableName(model: Model | string): Promise<string> {
  if (typeof model === 'string') {
    model = (await import(model)).default as Model
  }

  return model.table ?? snakeCase(plural(model?.name || ''))
}

export async function hasTableBeenMigrated(tableName: string) {
  log.debug(`hasTableBeenMigrated for table: ${tableName}`)

  const results = await getExecutedMigrations()

  return results.some((migration) => migration.name.includes(tableName))
}

export async function getExecutedMigrations() {
  try {
    return await db.selectFrom('migrations').select('name').execute()
  } catch (error) {
    return []
  }
}

function hasFunction(rule: VineType, functionName: string): boolean {
  return typeof rule[functionName] === 'function'
}

export function mapFieldTypeToColumnType(rule: VineType): string {
  if (hasFunction(rule, 'getChoices')) {
    // Condition checker if an attribute is enum, could not think any conditions atm
    const enumChoices = rule.getChoices() as string[]

    // Convert each string value to its corresponding string structure
    const enumStructure = enumChoices.map((value) => `'${value}'`).join(', ')

    // Construct the ENUM definition
    const enumDefinition = `sql\`enum(${enumStructure})\``

    return enumDefinition
  }

  if (rule[Symbol.for('schema_name')].includes('string'))
    // Default column type for strings
    return prepareTextColumnType(rule)

  if (rule[Symbol.for('schema_name')].includes('number')) return `'integer'`

  if (rule[Symbol.for('schema_name')].includes('boolean')) return `'boolean'`

  if (rule[Symbol.for('schema_name')].includes('date')) return `'date'`

  // need to now handle all other types

  // Add cases for other types as needed, similar to the original function
  switch (rule) {
    case 'integer':
      return `'int'`
    case 'boolean':
      return `'boolean'`
    case 'date':
      return `'date'`
    case 'datetime':
      return `'timestamp'`
    case 'float':
      return `'float'`
    case 'decimal':
      return `'decimal'`
    default:
      return `'text'` // Fallback for unknown types
  }
}

export function prepareTextColumnType(rule: VineType) {
  let columnType = 'varchar(255)'

  // Find min and max length validations
  const minLengthValidation = rule.validations.find((v: any) => v.options?.min !== undefined)
  const maxLengthValidation = rule.validations.find((v: any) => v.options?.max !== undefined)

  // If there's a max length validation, adjust the column type accordingly
  if (maxLengthValidation) {
    const maxLength = maxLengthValidation.options.max

    columnType = `varchar(${maxLength})`
  }

  // If there's only a min length validation and no max, consider using text
  // This is a simplistic approach; adjust based on your actual requirements
  if (minLengthValidation && !maxLengthValidation) columnType = 'text'

  return `'${columnType}'`
}

export async function checkPivotMigration(dynamicPart: string): Promise<boolean> {
  const files = await fs.readdir(path.userMigrationsPath())

  return files.some((migrationFile) => {
    // Escape special characters in the dynamic part to ensure it's treated as a literal string
    const escapedDynamicPart = dynamicPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // Construct the regular expression pattern dynamically
    const pattern = new RegExp(`(-${escapedDynamicPart}-)`)

    // Test if the input string matches the pattern
    return pattern.test(migrationFile)
  })
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
        const formattedModelName = model.name?.toLowerCase()

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

export async function fetchOtherModelRelations(model: Model): Promise<RelationConfig[]> {
  const modelFiles = glob.sync(path.userModelsPath('*.ts'))

  const modelRelations = []

  for (let i = 0; i < modelFiles.length; i++) {
    const modelFileElement = modelFiles[i] as string

    const modelFile = await import(modelFileElement)

    if (model.name === modelFile.default.name) continue

    const relations = await getRelations(modelFile.default)

    if (!relations.length) continue

    const relation = relations.find((relation) => relation.model === model.name)

    if (relation) modelRelations.push(relation)
  }

  return modelRelations
}

export async function getPivotTables(
  model: Model,
): Promise<{ table: string; firstForeignKey: string | undefined; secondForeignKey: string | undefined }[]> {
  const pivotTable = []

  if (model.belongsToMany && model.name) {
    if ('belongsToMany' in model) {
      for (const belongsToManyRelation of model.belongsToMany) {
        const modelRelationPath = path.userModelsPath(`${belongsToManyRelation}.ts`)
        const modelRelation = (await import(modelRelationPath)).default
        const formattedModelName = model.name.toLowerCase()

        const firstForeignKey =
          belongsToManyRelation.firstForeignKey || `${model.name?.toLowerCase()}_${model.primaryKey}`
        const secondForeignKey =
          belongsToManyRelation.secondForeignKey || `${modelRelation.name?.toLowerCase()}_${model.primaryKey}`

        pivotTable.push({
          table: belongsToManyRelation?.pivotTable || `${formattedModelName}_${modelRelation.table}`,
          firstForeignKey: firstForeignKey,
          secondForeignKey: secondForeignKey,
        })
      }

      return pivotTable
    }
  }

  return []
}

function hasRelations(obj: any, key: string): boolean {
  return key in obj
}
