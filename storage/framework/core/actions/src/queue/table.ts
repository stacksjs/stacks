import process from 'node:process'
import { createJobsMigration } from '@stacksjs/database'
import { log } from '@stacksjs/logging'

// first, reset the database, if it exists
const result = await createJobsMigration()

if (result?.isErr()) {
  console.error(result.error)
  log.error('generateMigrations failed', result.error)
  process.exit(1)
}

process.exit(0)
