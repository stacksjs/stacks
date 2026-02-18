import process from 'node:process'
import { createPersonalAccessClient } from '@stacksjs/auth'
import { log } from '@stacksjs/logging'

// first, reset the database, if it exists
const result = await createPersonalAccessClient()

if ((result as any)?.isErr) {
  console.error((result as any).error)
  log.error('createPersonalAccessClient failed', (result as any).error)
  process.exit(1)
}

process.exit(0)
