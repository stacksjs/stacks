import process from 'node:process'
import { log } from '@stacksjs/logging'
import { generateMigrations, runDatabaseMigration } from '@stacksjs/database'

// this is run and checks whether new created or update migrations need to be generated
const result = await generateMigrations()

if (result?.isErr()) {
  log.error('[stacks] generateMigrations failed', result.error)
  process.exit(1)
}

const result2 = await runDatabaseMigration()

if (result2.isErr()) {
  log.error('runDatabaseMigration failed')
  log.error(result2.error)
  process.exit(1)
}

process.exit(0)
