import type { CLI, ConflictStrategy } from '@stacksjs/types'
import process from 'node:process'
import { installStack } from '@stacksjs/actions'
import { intro, italic, log, onUnknownSubcommand, outro } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'

interface AddStackOptions {
  force?: boolean
  dryRun?: boolean
  conflict?: ConflictStrategy
  project?: string
  verbose?: boolean
}

export function add(buddy: CLI): void {
  buddy
    .command('add <stack>', 'Pull a registered stack and merge its project files into this Stacks application')
    .option('--force', 'Overwrite existing files', { default: false })
    .option('--dry-run', 'Show which files would be installed without changing the project', { default: false })
    .option('--conflict <strategy>', 'Resolve existing files with skip, overwrite, or backup', { default: 'skip' })
    .option('-p, --project <path>', 'Target a specific Stacks project')
    .option('--verbose', 'Show every file copied or skipped', { default: false })
    .example('buddy add calendar')
    .example('buddy add table --dry-run')
    .example('buddy add calendar --conflict backup')
    .action(async (stack: string, options: AddStackOptions) => {
      const perf = await intro('buddy add')
      const result = await installStack({
        name: stack,
        force: options.force,
        dryRun: options.dryRun,
        conflict: options.conflict,
        project: options.project,
        verbose: options.verbose,
      })

      if (!result) {
        await outro(`Could not add stack ${italic(stack)}.`, { startTime: perf, useSeconds: true })
        process.exit(ExitCode.FatalError)
      }

      if (options.dryRun)
        log.info('Dry run complete. No project files were changed.')

      await outro(`Stack ${italic(stack)} added.`, { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  onUnknownSubcommand(buddy, 'add')
}
