import process from 'node:process'
import { generateMigrations, resetDatabase, runDatabaseMigration } from '@stacksjs/database'
import { log } from '@stacksjs/logging'

// First, reset the database
const resetResult = await resetDatabase()

if (resetResult?.isErr) {
  console.error(resetResult.error)
  log.error('resetDatabase failed', resetResult.error)
  process.exit(1)
}

// Then generate fresh migrations
const genResult = await generateMigrations()

if (genResult?.isErr) {
  console.error(genResult.error)
  log.error('generateMigrations failed', genResult.error)
  process.exit(1)
}

// Finally, migrate the database
const migrateResult = await runDatabaseMigration()

if (migrateResult.isErr) {
  log.error('runDatabaseMigration failed')
  log.error(migrateResult.error)
  process.exit(1)
}

process.exit(0)
