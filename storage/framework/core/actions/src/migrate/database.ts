import process from 'node:process'
import { generateMigrations, runDatabaseMigration } from '@stacksjs/database'
import { log } from '@stacksjs/logging'

// Generate and run migrations
const result = await generateMigrations()

if (result?.isErr) {
  console.error(result.error)
  log.error('[stacks] generateMigrations failed', result.error)
  process.exit(1)
}

const migrateResult = await runDatabaseMigration()

if (migrateResult.isErr) {
  log.error('runDatabaseMigration failed')
  log.error(migrateResult.error)
  process.exit(1)
}

process.exit(0)
