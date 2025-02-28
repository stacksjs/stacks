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

// Use existing prepareTextColumnType function
export function prepareTextColumnType(rule: VineType, driver = 'mysql'): string {
  // For SQLite, all text fields are just 'text'
  if (driver === 'sqlite')
    return `'text'`

  let columnType = 'varchar(255)' // Default

  // Find min and max length validations using your existing function
  const characterLength = findCharacterLength(rule)

  // If there's a max length validation, adjust the column type accordingly
  if (characterLength && characterLength.max) {
    const maxLength = characterLength.max

    // Choose appropriate MySQL type based on length
    if (maxLength <= 255) {
      columnType = `varchar(${maxLength})`
    }
    else if (maxLength <= 65535) {
      columnType = 'text'
    }
    else if (maxLength <= 16777215) {
      columnType = 'mediumtext'
    }
    else {
      columnType = 'longtext'
    }
  }
  else {
    // Check for specific string formats if they exist in validations
    for (const validation of rule.validations || []) {
      if (validation.rule === 'email') {
        return `'varchar(255)'`
      }
      else if (validation.rule === 'url') {
        return `'varchar(2048)'`
      }
      else if (validation.rule === 'uuid') {
        return `'char(36)'`
      }
      else if (validation.rule === 'ip') {
        return `'varchar(45)'` // IPv6 can be up to 45 chars
      }
    }
  }

  return `'${columnType}'`
}

// Add new function for date/time column types
export function prepareDateTimeColumnType(rule: VineType, driver = 'mysql'): string {
  if (driver === 'sqlite')
    return `'text'` // SQLite uses TEXT for dates

  // Try to determine specific date type
  for (const validation of rule.validations || []) {
    if (validation.rule === 'date')
      return `'date'`
    if (validation.rule === 'datetime')
      return `'datetime'`
    if (validation.rule === 'time')
      return `'time'`
    if (validation.rule === 'timestamp')
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
  const modelFiles = globSync([path.userModelsPath('*.ts'), path.storagePath('framework/defaults/models/*.ts')], { absolute: true })

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
export function prepareNumberColumnType(rule: VineType, driver = 'mysql'): string {
  // SQLite uses a single numeric type for all numbers
  if (driver === 'sqlite')
    return `'numeric'`

  // Check for decimal validation
  let precision = 10
  let scale = 2
  let isDecimal = false

  // Check validations for precision/scale
  for (const validation of rule.validations || []) {
    if (validation.options?.precision) {
      precision = validation.options.precision
      isDecimal = true
    }
    if (validation.options?.scale) {
      scale = validation.options.scale
      isDecimal = true
    }
  }

  // Check for integer-only constraint
  const isInteger = rule.validations.some((v: any) => v.rule === 'integer')

  // Handle exact decimal values
  if (isDecimal) {
    return `'decimal(${precision},${scale})'`
  }

  // Handle integers with different storage requirements
  if (isInteger) {
    // Look for min/max values to determine appropriate integer type
    let min: number | undefined
    let max: number | undefined

    for (const validation of rule.validations || []) {
      if (validation.options?.min !== undefined)
        min = validation.options.min
      if (validation.options?.max !== undefined)
        max = validation.options.max
    }

    // If we have both bounds, choose an appropriate type
    if (min !== undefined && max !== undefined) {
      if (min >= -128 && max <= 127) {
        return `'tinyint'`
      }
      else if (min >= -32768 && max <= 32767) {
        return `'smallint'`
      }
      else if (min >= -8388608 && max <= 8388607) {
        return `'mediumint'`
      }
      else if (min >= -2147483648 && max <= 2147483647) {
        return `'int'`
      }
      else {
        return `'bigint'`
      }
    }

    // Default int type
    return `'int'`
  }

  // For floating point numbers, use double for better compatibility
  return `'double'`
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

  // Use existing schema_name check to determine main type
  const schemaName = rule[Symbol.for('schema_name')] || ''

  if (schemaName.includes('string')) {
    return prepareTextColumnType(rule, driver)
  }

  if (schemaName.includes('number')) {
    return prepareNumberColumnType(rule, driver)
  }

  if (schemaName.includes('boolean')) {
    return driver === 'sqlite' ? `'integer'` : `'tinyint(1)'`
  }

  if (schemaName.includes('date')) {
    return prepareDateTimeColumnType(rule, driver)
  }

  if (schemaName.includes('array') || schemaName.includes('object')) {
    return driver === 'sqlite' ? `'text'` : `'json'`
  }

  // Fallback for other types - UPDATED to avoid using 'float'
  switch (rule) {
    case 'integer':
      return `'int'`
    case 'boolean':
      return driver === 'sqlite' ? `'integer'` : `'tinyint(1)'`
    case 'date':
      return `'date'`
    case 'datetime':
      return driver === 'sqlite' ? `'text'` : `'datetime'`
    case 'timestamp':
      return `'timestamp'`
    case 'float':
      return `'double'`
    case 'decimal':
      return `'decimal(10,2)'`
    case 'uuid':
      return driver === 'sqlite' ? `'text'` : `'char(36)'`
    case 'binary':
      return driver === 'sqlite' ? `'blob'` : `'longblob'`
    default:
      return `'text'` // Fallback for unknown types
  }
}
