import type { Attribute, AttributesElements, Model, VineType } from '@stacksjs/types'
import { log } from '@stacksjs/cli'
import { db } from '@stacksjs/database'
import { handleError } from '@stacksjs/error-handling'
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

interface Validator {
  rules: Rule[]
  isRequired: boolean
  fieldName: string
  min: () => any
  max: () => any
  length: () => any
  email: () => any
  url: () => any
  matches: () => any
  alphanumeric: () => any
  alpha: () => any
  numeric: () => any
  custom: () => any
  required: () => any
  optional: () => any
  field: () => any
  addRule: () => any
  validate: () => any
  test: () => any
  formatMessage: () => any
}

interface Rule {
  name: string
  test: () => any
  message: string
}

export async function deleteMigrationFiles(): Promise<void> {
  const files = await fs.readdir(path.userMigrationsPath())

  if (files.length) {
    for (const file of files) {
      if (file.endsWith('.ts')) {
        const migrationPath = path.userMigrationsPath(`${file}`)

        if (fs.existsSync(migrationPath))
          await Bun.$`rm ${migrationPath}`
      }
    }
  }
}

export async function deleteFrameworkModels(): Promise<void> {
  const modelFiles = await fs.readdir(path.frameworkPath('models'))

  if (modelFiles.length) {
    for (const modelFile of modelFiles) {
      if (modelFile.endsWith('.ts')) {
        const modelPath = path.frameworkPath(`models/${modelFile}`)

        if (fs.existsSync(modelPath))
          await Bun.$`rm ${modelPath}`
      }
    }
  }
}

export async function getLastMigrationFields(modelName: string): Promise<AttributesElements> {
  const oldModelPath = path.frameworkPath(`models/${modelName}`)
  const model = (await import(oldModelPath)).default as Model
  let fields = {} as AttributesElements

  if (typeof model.attributes === 'object')
    fields = model.attributes
  else fields = JSON.parse(model.attributes || '{}') as AttributesElements

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

export async function hasMigrationBeenCreated(tableName: string): Promise<boolean> {
  log.debug(`hasTableBeenMigrated for table: ${tableName}`)

  const migrations = globSync([path.userMigrationsPath('*.ts')], { absolute: true })

  return migrations.some(path => path.includes(`create-${tableName}`))
}

export async function getExecutedMigrations(): Promise<{ name: string }[]> {
  try {
    return await db.selectFrom('migrations').select('name').execute()
  }

  catch (error: any) {
    if (error?.message.includes('no such table: migrations')) {
      console.warn('Migrations table does not exist, returning empty list.')

      return []
    }

    handleError(error, { shouldExitProcess: false })
    return []
  }
}

function hasFunction(rule: VineType, functionName: string): boolean {
  return typeof rule[functionName] === 'function'
}

export function findCharacterLength(rules: Rule[]): { min: number, max: number } | undefined {
  const result: any = {}

  // Find min and max length validations
  const minLengthValidation = rules.find(r => r.name === 'min' && r.test()?.min !== undefined)
  const maxLengthValidation = rules.find(r => r.name === 'max' && r.test()?.max !== undefined)

  if (minLengthValidation === undefined || maxLengthValidation === undefined) {
    return undefined
  }

  const minTest = minLengthValidation.test() as { min: number }
  const maxTest = maxLengthValidation.test() as { max: number }

  result.min = minTest.min
  result.max = maxTest.max

  return result
}

function getFormatSpecificType(rule: Rule): string | null {
  switch (rule.name) {
    case 'email':
      return `'varchar(255)'`
    case 'url':
      return `'varchar(2048)'`
    case 'uuid':
      return `'char(36)'`
    case 'ip':
      return `'varchar(45)'` // IPv6 can be up to 45 chars
    default:
      return null
  }
}

export function prepareTextColumnType(validator: Validator, driver = 'mysql'): string {
  // For SQLite, all text fields are just 'text'
  if (driver === 'sqlite')
    return `'text'`

  // First check for format-specific types
  for (const rule of validator.rules) {
    // Skip the base 'string' type as we'll handle that with length checks
    if (rule.name === 'string')
      continue

    const formatType = getFormatSpecificType(rule)
    if (formatType)
      return formatType
  }

  // Then check for length-based types
  const characterLength = findCharacterLength(validator.rules)
  if (characterLength?.max) {
    const maxLength = characterLength.max

    // Choose appropriate MySQL type based on length
    if (maxLength <= 255)
      return `'varchar(${maxLength})'`
    if (maxLength <= 65535)
      return `'text'`
    if (maxLength <= 16777215)
      return `'mediumtext'`
    
    return `'longtext'`
  }

  // Default to varchar(255)
  return `'varchar(255)'`
}

// Add new function for date/time column types
export function prepareDateTimeColumnType(validator: Validator, driver = 'mysql'): string {
  if (driver === 'sqlite')
    return `'text'` // SQLite uses TEXT for dates

  // Try to determine specific date type
  for (const rule of validator.rules) {
    if (rule.name === 'date')
      return `'date'`
    if (rule.name === 'datetime')
      return `'datetime'`
    if (rule.name === 'time')
      return `'time'`
    if (rule.name === 'timestamp')
      return `'timestamp'`
  }

  // Default to datetime
  return `'datetime'`
}

export function compareRanges(range1: Range, range2: Range): boolean {
  return range1.min === range2.min && range1.max === range2.max
}

export async function checkPivotMigration(dynamicPart: string): Promise<boolean> {
  const files = await fs.readdir(path.userMigrationsPath())

  return files.some((migrationFile: string) => {
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

export function arrangeColumns(attributes: AttributesElements | undefined): Array<[string, Attribute]> {
  if (!attributes)
    return []

  const entries = Object.entries(attributes)

  // Sort the entries based on the 'order' property

  // eslint-disable-next-line unused-imports/no-unused-vars
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
  const modelFiles = globSync([path.userModelsPath('*.ts'), path.storagePath('framework/defaults/models/**/*.ts')], { absolute: true })

  const tables: string[] = []

  for (const modelPath of modelFiles) {
    const model = (await import(modelPath)).default as Model
    const tableName = getTableName(model, modelPath)
    const upvoteTable = getUpvoteTableName(model, tableName)
    if (upvoteTable)
      tables.push(upvoteTable)

    tables.push(tableName)
  }

  return tables
}

function getUpvoteTableName(model: Model, tableName: string): string | undefined {
  const defaultTable = `${tableName}_likes`
  const traits = model.traits

  return typeof traits?.likeable === 'object'
    ? traits.likeable.table || defaultTable
    : undefined
}

// Updated function for numeric column types compatible with Kysely
export function prepareNumberColumnType(validator: Validator, driver = 'mysql'): string {
  // SQLite uses a single numeric type for all numbers
  if (driver === 'sqlite')
    return `'numeric'`

  // Check for decimal validation
  let precision = 10
  let scale = 2
  let isDecimal = false

  // Check validations for precision/scale
  for (const rule of validator.rules) {
    const testResult = rule.test()
    if (testResult?.precision) {
      precision = testResult.precision
      isDecimal = true
    }
    if (testResult?.scale) {
      scale = testResult.scale
      isDecimal = true
    }
  }

  // Check for integer-only constraint
  const isInteger = validator.rules.some(rule => rule.name === 'integer')

  // Handle exact decimal values
  if (isDecimal) {
    return `'decimal(${precision},${scale})'`
  }

  // Handle integers with different storage requirements
  if (isInteger) {
    // Look for min/max values to determine appropriate integer type
    let min: number | undefined
    let max: number | undefined

    for (const rule of validator.rules) {
      const testResult = rule.test()
      if (testResult?.min !== undefined)
        min = testResult.min
      if (testResult?.max !== undefined)
        max = testResult.max
    }

    // If we have both bounds, choose an appropriate type
    if (min !== undefined && max !== undefined) {
      if (min >= -128 && max <= 127)
        return `'tinyint'`
      if (min >= -32768 && max <= 32767)
        return `'smallint'`
      if (min >= -8388608 && max <= 8388607)
        return `'mediumint'`
      if (min >= -2147483648 && max <= 2147483647)
        return `'int'`
      
      return `'bigint'`
    }

    // Default int type
    return `'int'`
  }

  // For floating point numbers, use double for better compatibility
  return `'double'`
}

export function mapFieldTypeToColumnType(validator: Validator, driver = 'mysql'): string {
  // Check for enum type
  const enumRule = validator.rules.find(r => r.name === 'enum')
  if (enumRule) {
    if (driver === 'sqlite') {
      return `'text'`
    }

    // Get enum choices from the test function
    const enumChoices = enumRule.test() as string[]
    const enumStructure = enumChoices.map(value => `'${value}'`).join(', ')
    return `sql\`enum(${enumStructure})\``
  }

  // Check for base types
  const baseType = validator.rules.find(r => r.name === 'string')
  if (baseType) {
    return prepareTextColumnType(validator, driver)
  }

  if (validator.rules.some(r => r.name === 'number')) {
    return prepareNumberColumnType(validator, driver)
  }

  if (validator.rules.some(r => r.name === 'boolean')) {
    return driver === 'sqlite' ? `'integer'` : `'tinyint(1)'`
  }

  // Handle date types
  const dateType = validator.rules.find(r => ['date', 'datetime', 'time', 'timestamp'].includes(r.name))?.name
  if (dateType) {
    return prepareDateTimeColumnType(validator, driver)
  }

  // Handle array/object types
  if (validator.rules.some(r => ['array', 'object'].includes(r.name))) {
    return driver === 'sqlite' ? `'text'` : `'json'`
  }

  // Default fallback for unknown types
  return `'text'`
}
