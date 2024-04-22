// import type { Attribute, Attributes } from '@stacksjs/types'
import { path } from '@stacksjs/path'
import { log } from '@stacksjs/cli'
import { db } from '@stacksjs/database'

export async function getLastMigrationFields(modelName: string): Promise<Attribute> {
  const oldModelPath = path.frameworkPath(`database/models/${modelName}`)
  const model = await import(oldModelPath)
  let fields = {} as Attributes

  if (typeof model.default.attributes === 'object')
    fields = model.default.attributes
  else
    fields = JSON.parse(model.default.attributes) as Attributes

  return fields
}

export async function hasTableBeenMigrated(tableName: string) {
  log.debug(`hasTableBeenMigrated for table: ${tableName}`)

  const results = await getExecutedMigrations()

  return results.some(migration => migration.name.includes(tableName))
}

export async function getExecutedMigrations() {
  try {
    // @ts-expect-error the migrations table is not typed yet
    return await db.selectFrom('migrations').select('name').execute()
  }
  catch (error) {
    return []
  }
}

export function mapFieldTypeToColumnType(rule: any): string {
  // Check if the rule is for a string and has specific validations
  if (rule[Symbol.for('schema_name')].includes('string'))
  // Default column type for strings
    return prepareTextColumnType(rule)

  if (rule[Symbol.for('schema_name')].includes('number'))
    return 'integer'

  if (rule[Symbol.for('schema_name')].includes('boolean'))
    return 'boolean'

  if (rule[Symbol.for('schema_name')].includes('date'))
    return 'date'

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
  const minLengthValidation = rule.validations.find(v => v.options?.min !== undefined)
  const maxLengthValidation = rule.validations.find(v => v.options?.max !== undefined)

  // If there's a max length validation, adjust the column type accordingly
  if (maxLengthValidation) {
    const maxLength = maxLengthValidation.options.max
    columnType = `varchar(${maxLength})`
  }

  // If there's only a min length validation and no max, consider using text
  // This is a simplistic approach; adjust based on your actual requirements
  if (minLengthValidation && !maxLengthValidation)
    columnType = 'text'

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
