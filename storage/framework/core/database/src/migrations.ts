import { path } from '@stacksjs/path'
import { log } from '@stacksjs/logging'
import { err, ok } from '@stacksjs/error-handling'
import { fs, glob } from '@stacksjs/storage'
import type { FieldOptions } from '@stacksjs/types'
import { FileMigrationProvider, Migrator } from 'kysely'
import { database } from '@stacksjs/config'
import { db } from './utils'

export const migrator = new Migrator({
  db,

  provider: new FileMigrationProvider({
    fs,
    path,
    // This needs to be an absolute path.
    migrationFolder: path.userMigrationsPath(),
  }),

  migrationTableName: database.migrations,
  migrationLockTableName: database.migrationLocks,
})

export async function runDatabaseMigration() {
  try {
    log.info('Migrating database...')

    const migration = await migrator.migrateToLatest()

    if (migration.error) {
      log.error(migration.error)
      return err(migration.error)
    }

    if (migration.results?.length === 0) {
      log.success('No new migrations were executed')
      return ok('No new migrations were executed')
    }

    if (migration.results) {
      migration.results.forEach(({ migrationName }) => {
        log.info(`Migration Name: ${migrationName}`)
      })

      log.success('Database migrated successfully.')
      return ok(migration)
    }

    log.success('Database migration completed with no new migrations.')
    return ok('Database migration completed with no new migrations.')
  }
  catch (error) {
    console.error('Migration failed:', error)
    return err(error)
  }
}

export interface MigrationOptions {
  name: string
  up: string
}

export function generateMigrationFile(options: MigrationOptions) {
  const { name, up } = options

  const timestamp = new Date().getTime().toString()
  const fileName = `${timestamp}-${name}.ts`
  const filePath = path.userMigrationsPath(fileName)
  const fileContent = `import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
  ${up}
})`

  // TODO: use Bun.write
  fs.writeFileSync(filePath, fileContent)

  log.success(`Created migration file: ${fileName}`)
}

export async function generateMigrations() {
  log.info('Generating migrations based on your models...')

  // Assuming path.modelsPath('*') returns a glob pattern for all model files
  const modelFiles = glob.sync(path.userModelsPath('*.ts'))

  for (const file of modelFiles) {
    const model = await import(file)
    const tableName = model.default.table
    const fields = model.default.fields

    let migrationContent = `import type { Database } from '@stacksjs/database'\n`
    migrationContent += `import { sql } from '@stacksjs/database'\n\n`
    migrationContent += `export async function up(db: Database<any>) {\n`
    migrationContent += `  await db.schema\n`
    migrationContent += `    .createTable('${tableName}')\n`

    for (const [fieldName, options] of Object.entries(fields)) {
      const fieldOptions = options as FieldOptions
      const columnType = mapFieldTypeToColumnType(fieldOptions.validator?.rule) // You need to implement this function based on your validation rules
      migrationContent += `    .addColumn('${fieldName}', '${columnType}', col => col`
      if (fieldOptions.unique)
        migrationContent += `.unique()`

      if (fieldOptions.validator?.rule?.required)
        migrationContent += `.notNull()`

      migrationContent += `)\n`
    }

    migrationContent += `    .execute()\n`
    migrationContent += `}\n`

    const timestamp = new Date().getTime().toString()
    const migrationFileName = `${timestamp}-create-${tableName}-table.ts`
    const migrationFilePath = path.join(path.userMigrationsPath(), migrationFileName)

    // Assuming fs.writeFileSync is available or use an equivalent method
    fs.writeFileSync(migrationFilePath, migrationContent)

    log.success(`Created migration file: ${migrationFileName}`)
  }
}

function mapFieldTypeToColumnType(rule) {
  // Implement this function based on your validation rules to database column types
  // This is a placeholder function. You need to map your field types to SQL column types.
  return 'text' // Default to text for simplicity
}
