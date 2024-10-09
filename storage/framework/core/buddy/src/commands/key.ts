import type { CLI, KeyOptions } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'

export function key(buddy: CLI): void {
  const descriptions = {
    command: 'Generate & set the application key.',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('key:generate', descriptions.command)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: KeyOptions) => {
      log.debug('Running `buddy key:generate` ...', options)

      await intro('buddy key:generate')
      const result = await runAction(Action.KeyGenerate, options)

      if (result.isErr()) {
        log.error('Failed to set random application key.', result.error)
        process.exit()
      }

      await outro('Random application key set.')
    })

  buddy.on('key:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
