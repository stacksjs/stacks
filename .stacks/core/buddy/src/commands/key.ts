import process from 'node:process'
import { type CLI, type KeyOptions } from '@stacksjs/types'
import { intro, log, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'

export function key(buddy: CLI) {
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
        log.error('Failed to set random application key.', result.error)
        process.exit()
      }

      await outro('Random application key set.', { startTime })
    })
}
