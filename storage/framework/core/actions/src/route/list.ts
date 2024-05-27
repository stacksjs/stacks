import process from 'node:process'
import { listRoutes } from '@stacksjs/router'
import { log } from '@stacksjs/logging'

// first, reset the database, if it exists
const result = await listRoutes()

if (result?.isErr()) {
  console.error(result.error)
  log.error('Route lists failed', result.error)
  process.exit(1)
}

process.exit(0)
