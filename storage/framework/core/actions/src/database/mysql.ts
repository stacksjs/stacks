import { fs, glob } from '@stacksjs/storage'
import { path } from '@stacksjs/path'
import { ok } from '@stacksjs/error-handling'
import { db } from '@stacksjs/database'

export async function resetMysqlDatabase() {
  const tables = await fetchMysqlTables()

  for (const table of tables)
    await db.schema.dropTable(table).ifExists().execute()

  await db.schema.dropTable('migrations').ifExists().execute()
  await db.schema.dropTable('migration_locks').ifExists().execute()

  const files = await fs.readdir(path.userMigrationsPath())
  const modelFiles = await fs.readdir(path.frameworkPath('database/models'))

  if (modelFiles.length) {
    for (const modelFile of modelFiles) {
      if (modelFile.endsWith('.ts')) {
        const modelPath = path.frameworkPath(`database/models/${modelFile}`)

        if (fs.existsSync(modelPath))
          await Bun.$`rm ${modelPath}`
      }
    }
  }

  if (files.length) {
    for (const file of files) {
      if (file.endsWith('.ts')) {
        const migrationPath = path.userMigrationsPath(`${file}`)

        if (fs.existsSync(migrationPath))
          await Bun.$`rm ${migrationPath}`
      }
    }
  }

  return ok('All tables dropped successfully!')
}

export async function fetchMysqlTables(): Promise<string[]> {
  const modelFiles = glob.sync(path.userModelsPath('*.ts'))
  const tables: string[] = []

  for (const modelPath of modelFiles) {
    const model = await import(modelPath)

    const tableName = model.default.table

    tables.push(tableName)
  }

  return tables
}
