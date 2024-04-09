import { fs } from '@stacksjs/storage'
import { path } from '@stacksjs/path'
import { ok } from '@stacksjs/error-handling'

export async function resetSqliteDatabase() {
  const dbPath = path.userDatabasePath('stacks.sqlite')

  if (fs.existsSync(dbPath))
    await Bun.$`rm ${dbPath}`

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
