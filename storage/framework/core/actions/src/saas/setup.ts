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

// A conflict is something in the account that differs from config/saas.ts and
// was deliberately left alone (a coupon cannot be edited). Say so in the exit
// code too, so a CI step that runs this does not pass over it.
const conflicts = report.actions.filter(action => action.verb === 'conflict')
if (conflicts.length) {
  await log.error(`stripe:setup left ${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'} for you to resolve.`)
  process.exit(1)
}
