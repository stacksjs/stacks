import type { CLI, KeyOptions } from '@stacksjs/types'
import { intro, outro } from '@stacksjs/cli'
import { log } from '@stacksjs/logging'
import { Action } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'

export async function key(buddy: CLI) {
  const descriptions = {
    command: 'Generate & set the application key.',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('key:generate', descriptions.command)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: KeyOptions) => {
      const startTime = await intro('buddy key:generate')
      const result = await runAction(Action.KeyGenerate, options)

      if (result.isErr()) {
        log.error('Failed to set random application key.', result.error as Error)
        process.exit()
      }

      outro('Set random application key.', { startTime })
    })
}
