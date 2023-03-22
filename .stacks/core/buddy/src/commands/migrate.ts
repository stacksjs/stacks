import { migrations } from '@stacksjs/actions/generate'
import type { CLI, FreshOptions } from '@stacksjs/types'

async function migrate(buddy: CLI) {
  const descriptions = {
    migrate: 'Migrates your database',
    verbose: 'Enable verbose output',
    debug: 'Enable debug mode',
  }

  buddy
    .command('migrate', descriptions.migrate)
    .option('--verbose', descriptions.verbose, { default: false })
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: FreshOptions) => {
      await migrations()
    })
}

export { migrate }
