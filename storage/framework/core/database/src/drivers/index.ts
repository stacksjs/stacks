import { log } from '@stacksjs/cli'
import { db } from '@stacksjs/database'
import { path } from '@stacksjs/path'
import { fs } from '@stacksjs/storage'
import type { Attributes, Model, RelationConfig } from '@stacksjs/types'

export * from './mysql'
export * from './postgres'
export * from './sqlite'

export async function getLastMigrationFields(modelName: string): Promise<Attribute> {
  const oldModelPath = path.frameworkPath(`database/models/${modelName}`)
  const model = await import(oldModelPath)
  let fields = {} as Attributes

  if (typeof model.default.attributes === 'object') fields = model.default.attributes
  else fields = JSON.parse(model.default.attributes) as Attributes

  return fields
}

export async function hasTableBeenMigrated(tableName: string) {
  log.debug(`hasTableBeenMigrated for table: ${tableName}`)

  const results = await getExecutedMigrations()

  return results.some((migration) => migration.name.includes(tableName))
}

export async function getExecutedMigrations() {
  try {
    // @ts-expect-error the migrations table is not typed yet
    return await db.selectFrom('migrations').select('name').execute()
  } catch (error) {
    return []
  }
}

export function mapFieldTypeToColumnType(rule: any): string {
  // Check if the rule is for a string and has specific validations
  if (rule[Symbol.for('schema_name')].includes('string'))
    // Default column type for strings
    return prepareTextColumnType(rule)

  if (rule[Symbol.for('schema_name')].includes('number')) return 'integer'

  if (rule[Symbol.for('schema_name')].includes('boolean')) return 'boolean'

  if (rule[Symbol.for('schema_name')].includes('date')) return 'date'

  // need to now handle all other types

  // Add cases for other types as needed, similar to the original function
  switch (rule) {
    case 'integer':
      return 'int'
    case 'boolean':
      return 'boolean'
    case 'date':
      return 'date'
    case 'datetime':
      return 'timestamp'
    case 'float':
      return 'float'
    case 'decimal':
      return 'decimal'
    default:
      return 'text' // Fallback for unknown types
  }
}

export function prepareTextColumnType(rule) {
  let columnType = 'varchar(255)'

  // Find min and max length validations
  const minLengthValidation = rule.validations.find((v) => v.options?.min !== undefined)
  const maxLengthValidation = rule.validations.find((v) => v.options?.max !== undefined)

  // If there's a max length validation, adjust the column type accordingly
  if (maxLengthValidation) {
    const maxLength = maxLengthValidation.options.max
    columnType = `varchar(${maxLength})`
  }

  // If there's only a min length validation and no max, consider using text
  // This is a simplistic approach; adjust based on your actual requirements
  if (minLengthValidation && !maxLengthValidation) columnType = 'text'

  return columnType
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
        const modelRelationPath = path.userModelsPath(`${relationInstance.model}.ts`)
        const modelRelation = (await import(modelRelationPath)).default
        const formattedModelName = model.name.toLowerCase()

        relationships.push({
          relationship: relation,
          model: relationInstance.model,
          table: modelRelation.table,
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

export async function fetchOtherModelRelations(model: Model, modelFiles: string[]) {
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
