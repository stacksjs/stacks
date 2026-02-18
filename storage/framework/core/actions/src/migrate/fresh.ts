import process from 'node:process'
import { generateMigrations, resetDatabase, runDatabaseMigration } from '@stacksjs/database'
import { log } from '@stacksjs/logging'

// First, reset the database
const resetResult = await resetDatabase()

if ((resetResult as any)?.isErr) {
  console.error((resetResult as any).error)
  log.error('resetDatabase failed', (resetResult as any).error)
  process.exit(1)
}

// Then generate fresh migrations
const genResult = await generateMigrations()

if ((genResult as any)?.isErr) {
  console.error((genResult as any).error)
  log.error('generateMigrations failed', (genResult as any).error)
  process.exit(1)
}

// Finally, migrate the database
const migrateResult = await runDatabaseMigration()

if ((migrateResult as any).isErr) {
  log.error('runDatabaseMigration failed')
  log.error((migrateResult as any).error)
  process.exit(1)
}

process.exit(0)
