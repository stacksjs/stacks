import type { Attribute, Attributes, Model, VineType } from '@stacksjs/types'
import { log } from '@stacksjs/cli'
import { db } from '@stacksjs/database'
import { getTableName } from '@stacksjs/orm'
import { path } from '@stacksjs/path'
import { fs, globSync } from '@stacksjs/storage'
import { plural, snakeCase } from '@stacksjs/strings'

export * from './mysql'
export * from './postgres'
export * from './sqlite'

interface Range {
  min: number
  max: number
}

export async function getLastMigrationFields(modelName: string): Promise<Attributes> {
  const oldModelPath = path.frameworkPath(`database/models/${modelName}`)
  const model = (await import(oldModelPath)).default as Model
  let fields = {} as Attributes

  if (typeof model.attributes === 'object')
    fields = model.attributes
  else fields = JSON.parse(model.attributes || '{}') as Attributes

  return fields
}

export async function modelTableName(model: Model | string): Promise<string> {
  if (typeof model === 'string') {
    model = (await import(model)).default as Model
  }

  return model.table ?? snakeCase(plural(model?.name || ''))
}

export async function hasTableBeenMigrated(tableName: string): Promise<boolean> {
  log.debug(`hasTableBeenMigrated for table: ${tableName}`)

  const results = await getExecutedMigrations()

  return results.some(migration => migration.name.includes(tableName))
}

export async function getExecutedMigrations(): Promise<{ name: string }[]> {
  try {
    return await db.selectFrom('migrations').select('name').execute()
  }

  catch (error) {
    return []
  }
}

function hasFunction(rule: VineType, functionName: string): boolean {
  return typeof rule[functionName] === 'function'
}

export function mapFieldTypeToColumnType(rule: VineType, driver = 'mysql'): string {
  if (hasFunction(rule, 'getChoices')) {
    if (driver === 'sqlite') {
      return `'text'`
    }

    // Condition checker if an attribute is enum, could not think any conditions atm
    const enumChoices = rule.getChoices() as string[]

    // Convert each string value to its corresponding string structure
    const enumStructure = enumChoices.map(value => `'${value}'`).join(', ')

    // Construct the ENUM definition
    const enumDefinition = `sql\`enum(${enumStructure})\``

    return enumDefinition
  }

  if (rule[Symbol.for('schema_name')].includes('string'))
    // Default column type for strings
    return prepareTextColumnType(rule)

  if (rule[Symbol.for('schema_name')].includes('number'))
    return `'integer'`
  if (rule[Symbol.for('schema_name')].includes('boolean'))
    return `'boolean'`
  if (rule[Symbol.for('schema_name')].includes('date'))
    return `'date'`

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
  if (minLengthValidation && !maxLengthValidation)
    columnType = 'text'

  return `'${columnType}'`
}

export function findCharacterLength(rule: VineType): { min: number, max: number } | undefined {
  const result: any = {}

  // Find min and max length validations
  const minLengthValidation = rule.validations.find((v: any) => v.options?.min !== undefined)
  const maxLengthValidation = rule.validations.find((v: any) => v.options?.max !== undefined)

  if (minLengthValidation === undefined || maxLengthValidation === undefined) {
    return undefined
  }

  for (const key of ['min', 'max']) {
    if (maxLengthValidation.options[key] === undefined && minLengthValidation.options[key] === undefined)
      continue

    result.max = maxLengthValidation.options[key]
    result.min = minLengthValidation.options[key]
  }

  // if (minLengthValidation.options[key] !== maxLengthValidation.options[key]) {
  //   result[key] = maxLengthValidation.options[key];
  // }
  return result
}

export function compareRanges(range1: Range, range2: Range): boolean {
  return range1.min === range2.min && range1.max === range2.max
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

export function pluckChanges(array1: string[], array2: string[]): { added: string[], removed: string[] } | null {
  const removed = array1.filter(item => !array2.includes(item))
  const added = array2.filter(item => !array1.includes(item))

  if (removed.length === 0 && added.length === 0) {
    return null
  }

  return { added, removed }
}

export function arrangeColumns(attributes: Attributes | undefined): Array<[string, Attribute]> {
  if (!attributes)
    return []

  const entries = Object.entries(attributes)

  // Sort the entries based on the 'order' property

  entries.sort(([keyA, valueA], [keyB, valueB]) => {
    const orderA = valueA.order ?? Number.POSITIVE_INFINITY
    const orderB = valueB.order ?? Number.POSITIVE_INFINITY
    return orderA - orderB
  })

  return entries // Return the sorted key-value pairs
}

export function isArrayEqual(arr1: (number | undefined)[], arr2: (number | undefined)[]): boolean {
  if (!arr1 || !arr2) {
    return false
  }

  if (arr1.length !== arr2.length)
    return false

  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i])
      return false
  }

  return true
}

export function findDifferingKeys(obj1: any, obj2: any): { key: string, max: number, min: number }[] {
  const differingKeys: { key: string, max: number, min: number }[] = []

  for (const key in obj1) {
    if (Object.prototype.hasOwnProperty.call(obj1, key) && Object.prototype.hasOwnProperty.call(obj2, key)) {
      const lastCharacterLength = findCharacterLength(obj1[key].validation.rule)
      const latestCharacterLength = findCharacterLength(obj2[key].validation.rule)

      if (lastCharacterLength !== undefined && latestCharacterLength !== undefined) {
        if (
          lastCharacterLength.max !== latestCharacterLength.max
          || lastCharacterLength.min !== latestCharacterLength.min
        ) {
          differingKeys.push({ key, max: latestCharacterLength.max, min: latestCharacterLength.min })
        }
      }
    }
  }

  return differingKeys
}

export async function fetchTables(): Promise<string[]> {
  const modelFiles = globSync(path.userModelsPath('*.ts'), { absolute: true })

  const tables: string[] = []

  for (const modelPath of modelFiles) {
    const model = (await import(modelPath)).default as Model
    const tableName = getTableName(model, modelPath)

    tables.push(tableName)
  }

  return tables
}
