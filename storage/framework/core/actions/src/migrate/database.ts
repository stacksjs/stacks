import process from 'node:process'
import { generateMigrations, runDatabaseMigration } from '@stacksjs/database'
import { path } from '@stacksjs/path'
import { glob } from '@stacksjs/storage'

// if no migrations, generate them
const migrations = glob.sync(path.userMigrationsPath('*.ts'))
if (migrations.length === 0)
  await generateMigrations()

const result = await runDatabaseMigration()

if (result.isErr()) {
  console.error('Migration failed:', result.error)
  process.exit(1)
}

process.exit(0)
