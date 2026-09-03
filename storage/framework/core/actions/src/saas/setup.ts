import process from 'node:process'
import { log } from '@stacksjs/logging'
import { createStripeProduct, formatSetupReport } from '@stacksjs/payments'

// `runAction(Action.StripeSetup, options)` spawns this file with `buddyOptions`
// translating the CLI options into argv flags, so the flags have to be read
// here. They were not, which meant `--dry-run` created real products in a real
// Stripe account while the help text promised a preview (stacksjs/stacks#2359).
const argv = process.argv.slice(2)
const dryRun = argv.includes('--dry-run') || argv.includes('--dryRun')

const result = await createStripeProduct({ dryRun })

if (result?.isErr) {
  console.error(result.error)
  await log.error('stripe:setup failed', result.error)
  process.exit(1)
}

const report = result.value
log.info(dryRun
  ? 'Dry run. Nothing was written to Stripe. This is what would be applied:'
  : 'Applied:')
for (const line of formatSetupReport(report))
  log.info(line)
