import type { ChangelogOptions, CLI } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, onUnknownSubcommand, outro } from "@stacksjs/cli"
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'

export function changelog(buddy: CLI): void {
  const descriptions = {
    changelog: 'Create a CHANGELOG.md file',
    quiet: 'Minimal output',
    dryRun: 'Do not write the file, just output the changes',
    from: 'Start git revision for generated changelog',
    project: 'Target a specific project',
    to: 'End git revision for generated changelog',
    verbose: 'Enable verbose output',
    version: 'Version heading to use for the generated changelog entry',
  }

  // console.log('changelog', descriptions.changelog)

  buddy
    .command('changelog', descriptions.changelog)
    .option('-q, --quiet', descriptions.quiet, { default: false })
    .option('-d, --dry-run', descriptions.dryRun, { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--from <revision>', descriptions.from)
    .option('--to <revision>', descriptions.to)
    .option('--version <version>', descriptions.version)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: ChangelogOptions) => {
      log.debug('Running `buddy changelog` ...', options)

      const perf = await intro('buddy changelog')
      const result = await runAction(Action.Changelog, options)

      if (result.isErr) {
        await outro(
          'While running the changelog command, there was an issue',
          { ...options, startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro('Generated CHANGELOG.md', {
        ...options,
        startTime: perf,
        useSeconds: true,
        type: 'success',
      })
    })

  onUnknownSubcommand(buddy, 'changelog')
}
