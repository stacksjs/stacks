
import type { Attribute, AttributesElements, Model } from '@stacksjs/types'
import { log } from '@stacksjs/cli'
import { db } from '@stacksjs/database'
import { getTableName } from '@stacksjs/orm'
import { path } from '@stacksjs/path'
import { fs, globSync } from '@stacksjs/storage'
import { plural, snakeCase } from '@stacksjs/strings'
import { checkValidator, findCharacterLength } from '../validators'
import type { ValidationType } from '@stacksjs/ts-validation'

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


export function mapFieldTypeToColumnType(validator: ValidationType, driver = 'mysql'): string {
  const type = checkValidator(validator, driver)

  if (type !== '')
    return type

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
