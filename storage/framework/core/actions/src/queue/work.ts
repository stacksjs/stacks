import process from 'node:process'
import { processJobs } from '@stacksjs/queue'
import { log } from '@stacksjs/logging'

// first, reset the database, if it exists
const result = await processJobs()

// if (result?.isErr()) {
//   console.error(result.error)
//   log.error('generateMigrations failed', result.error)
//   process.exit(1)
// }

process.exit(0)
