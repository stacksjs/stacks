import process from 'node:process'
import { log } from '@stacksjs/logging'
import { processJobs } from '@stacksjs/queue'

const result = await processJobs()

if (result?.isErr()) {
  console.error(result.error)
  log.error('generateMigrations failed', result.error)
  process.exit(1)
}
