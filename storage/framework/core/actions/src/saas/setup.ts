import process from 'node:process'
import { createStripeProduct } from '@stacksjs/database'
import { log } from '@stacksjs/logging'

if (result?.isErr()) {
  console.error(result.error)
  log.error('generateMigrations failed', result.error)
  process.exit(1)
}
