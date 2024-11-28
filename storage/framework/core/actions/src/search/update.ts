import process from 'node:process'
import { log } from '@stacksjs/logging'
import { createStripeProduct } from '@stacksjs/payments'

const result = await createStripeProduct()

if (result?.isErr()) {
  console.error(result.error)
  log.error('generateMigrations failed', result.error)
  process.exit(1)
}
