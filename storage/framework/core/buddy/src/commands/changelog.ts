import type { CLI, FreshOptions } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'

export function changelog(buddy: CLI): void {
  const descriptions = {
    changelog: 'Create a CHANGELOG.md file',
    quiet: 'Minimal output',
    dryRun: 'Do not write the file, just output the changes',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  // console.log('changelog', descriptions.changelog)

  buddy
    .command('changelog', descriptions.changelog)
    .option('-q, --quiet', descriptions.quiet, { default: false })
    .option('-d, --dry-run', descriptions.dryRun, { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: FreshOptions) => {
      log.debug('Running `buddy changelog` ...', options)

      const perf = await intro('buddy changelog')
      const result = await runAction(Action.Changelog, options)

      if (result.isErr()) {
        await outro(
          'While running the changelog command, there was an issue',
          { ...options, startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
      }

      await outro('Generated CHANGELOG.md', {
        ...options,
        startTime: perf,
        useSeconds: true,
        type: 'success',
      })
    })

  buddy.on('changelog:*', () => {
    console.log('Invalid command: %s', buddy.args.join(' '))
    console.log('See --help for a list of available commands.')
    process.exit(1)
  })
}
