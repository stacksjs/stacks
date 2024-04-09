import process from 'node:process'
import { log } from '@stacksjs/logging'
import { resetDatabase } from '@stacksjs/database'

// this is run and checks whether new created or update migrations need to be generated
const result = await resetDatabase()

if (result?.isErr()) {
  console.error(result.error)
  log.error('[stacks] generateMigrations failed', result.error)
  process.exit(1)
}

process.exit(0)
