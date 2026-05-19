import process from 'node:process'
import { log } from '@stacksjs/cli'
import { seed } from '@stacksjs/database'

// `runAction(Action.Seed, options)` spawns this file with `buddyOptions`
// translating the CLI options into argv flags. Bridge the auth-relevant
// ones here so the seeder's protected-model guard (stacksjs/stacks#1852)
// can be opted out of without reaching for env vars.
const argv = process.argv.slice(2)
const allowProtected = argv.includes('--allow-protected') || argv.includes('--allowProtected')
const fresh = argv.includes('--fresh')

const startTime = Date.now()

try {
  const result = await seed({ verbose: true, fresh, allowProtected })
  const duration = Date.now() - startTime

  if (result.failed > 0) {
    log.warn('')
    log.warn(`Seeding completed with ${result.failed} failure(s):`)

    for (const r of result.results) {
      if (!r.success) {
        log.error(`  - ${r.model}: ${r.error}`)
      }
    }

    log.info('')
    log.info('Note: Failed models may have schema mismatches or invalid factory functions.')
    log.info('Tip: Run `./buddy migrate:fresh` to ensure schema is up to date.')
  }

  log.info('')
  log.success(`Seeding completed in ${duration}ms`)
  log.info(`  Total models: ${result.total}`)
  log.info(`  Successful: ${result.successful}`)
  log.info(`  Failed: ${result.failed}`)

  // Exit with code 0 even with partial failures (seeding still completed)
  process.exit(0)
}
catch (err) {
  log.error('Seeding failed catastrophically:', err)
  process.exit(1)
}
