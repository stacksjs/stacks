import type { DateValidatorType, EnumValidatorType, NumberValidatorType, StringValidatorType, ValidationType } from '@stacksjs/ts-validation'
import type { Attribute, AttributesElements, Model } from '@stacksjs/types'
import { log } from '@stacksjs/cli'
import { db } from '@stacksjs/database'
import { getTableName } from '@stacksjs/orm'
import { path } from '@stacksjs/path'
import { fs, globSync } from '@stacksjs/storage'
import { plural, snakeCase } from '@stacksjs/strings'
import { enumValidator, isBooleanValidator, isDatetimeValidator, isDateValidator, isFloatValidator, isNumberValidator, isStringValidator, isTimestampValidator, isUnixValidator } from '../validators'

export * from './mysql'
export * from './postgres'
export * from './sqlite'

interface Range {
  min: number
  max: number
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

    return []
  }
}

function findCharacterLength(validator: ValidationType): number {
  // Check for max length constraint
  if ('getRules' in validator) {
    const maxLengthRule = validator.getRules().find((rule: any) => rule.name === 'max')

    return maxLengthRule?.params?.length || maxLengthRule?.params?.max || 255
  }

  return 255
}

export function prepareTextColumnType(validator: StringValidatorType, driver = 'mysql'): string {
  // SQLite uses TEXT for all string types
  if (driver === 'sqlite')
    return `'text'`

  // Get length and choose appropriate MySQL type
  const maxLength = findCharacterLength(validator)

  return `'varchar(${maxLength})'`
}

// Add new function for date/time column types
export function prepareDateTimeColumnType(validator: DateValidatorType, driver = 'mysql'): string {
  if (driver === 'sqlite')
    return `'text'` // SQLite uses TEXT for dates

  const name = validator.name
  // Try to determine specific date type

  if (name === 'unix')
    return `'bigint'`

  // Default to datetime
  return name || 'date'
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
  entries.sort(([_keyA, valueA], [_keyB, valueB]) => {
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
          lastCharacterLength !== latestCharacterLength
        ) {
          differingKeys.push({ key, max: latestCharacterLength, min: latestCharacterLength })
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

export function getUpvoteTableName(model: Model, tableName: string): string | undefined {
  const defaultTable = `${tableName}_likes`
  const traits = model.traits

  return typeof traits?.likeable === 'object'
    ? traits.likeable.table || defaultTable
    : undefined
}

export function prepareNumberColumnType(validator: NumberValidatorType, driver = 'mysql'): string {
  // SQLite uses integer for all numbers
  if (driver === 'sqlite')
    return `'integer'`

  // Check for integer types
  if ('getRules' in validator) {
    const minRule = validator.getRules().find((rule: any) => rule.name === 'min')
    const maxRule = validator.getRules().find((rule: any) => rule.name === 'max')

    const min = minRule?.params?.min ?? -2147483648
    const max = maxRule?.params?.max ?? 2147483647

    return min >= -2147483648 && max <= 2147483647 ? `'integer'` : `'bigint'`
  }

  return `'integer'`
}

// Add new function for enum column types
export function prepareEnumColumnType(validator: EnumValidatorType, driver = 'mysql'): string {
  const allowedValues = validator.getAllowedValues()

  if (!allowedValues)
    throw new Error('Enum rule found but no allowedValues defined')

  const enumStructure = allowedValues.map((value: any) => `'${value}'`).join(', ')

  if (driver === 'postgres')
    return `'varchar(255)'`

  if (driver === 'sqlite')
    return `'text'` // SQLite doesn't support ENUM, but we'll enforce values at app level

  return `sql\`enum(${enumStructure})\`` // MySQL supports native ENUM
}

export function mapFieldTypeToColumnType(validator: ValidationType, driver = 'mysql'): string {
  if (enumValidator(validator))
    return prepareEnumColumnType(validator, driver)

  // Check for base types
  if (isStringValidator(validator))
    return prepareTextColumnType(validator, driver)

  if (isNumberValidator(validator))
    return prepareNumberColumnType(validator, driver)

  if (isBooleanValidator(validator))
    return `'boolean'` // Use boolean type for both MySQL and SQLite

  // Handle date types

  if (isDateValidator(validator))
    return `'date'`

  if (isDatetimeValidator(validator))
    return driver === 'postgres' ? `'timestamp'` : `'datetime'`

  if (isUnixValidator(validator))
    return `'bigint'`

  if (isTimestampValidator(validator))
    return `'timestamp'`

  if (isFloatValidator(validator))
    return `'float4'`

  // Handle array/object types
  if (['array', 'object'].includes(validator.name))
    return driver === 'sqlite' ? `'text'` : `'json'`

  if (driver === 'sqlite')
    return `'text'`

  return driver === 'mysql' ? `'varchar(255)'` : `'text'`
}

export function checkIsRequired(rule: string): boolean {
  // Check if the rule contains .required()
  return rule.includes('.required()')
}
