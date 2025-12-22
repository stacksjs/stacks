import process from 'node:process'
import { log } from '@stacksjs/cli'
import { seed } from '@stacksjs/database'

const startTime = Date.now()

try {
  const result = await seed({ verbose: true })
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
