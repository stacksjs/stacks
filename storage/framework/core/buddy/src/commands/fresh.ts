import type { CLI, FreshOptions } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, onUnknownSubcommand, outro } from "@stacksjs/cli"
import { hasTTY, isCI } from '@stacksjs/env'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'

export function fresh(buddy: CLI): void {
  const descriptions = {
    fresh: 'Re-installs your npm dependencies',
    project: 'Target a specific project',
    force: 'Skip the confirmation prompt (required in CI/non-interactive shells)',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('fresh', descriptions.fresh)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('-f, --force', descriptions.force, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: FreshOptions) => {
      log.debug('Running `buddy fresh` ...', options)

      // `--force` (or the legacy CLI-level bypasses) skips the confirmation.
      const skipConfirm = options.force === true
        || Boolean((buddy as unknown as Record<string, unknown>).isForce)
        || Boolean((buddy as unknown as Record<string, unknown>).isNoInteraction)

      // Safety guard (stacksjs/stacks#2002): in a non-interactive shell (CI,
      // piped stdin) the confirm prompt below has no one to answer it. Fail
      // fast and name the bypass flag instead of stalling the pipeline.
      if (!skipConfirm && (isCI || !hasTTY || !process.stdin.isTTY)) {
        log.syncError('Refusing to run `buddy fresh` from a non-interactive shell without confirmation.')
        log.fatal('   ➡️  Re-run with `--force` to proceed: `buddy fresh --force`')
      }

      // Check if confirmation is needed (not forced and not no-interaction mode)
      if (!skipConfirm) {
        const { confirm } = await import('@stacksjs/cli')
        const confirmed = await confirm({
          message: 'This will remove and reinstall all dependencies. Continue?',
          initial: false,
        })

        if (!confirmed) {
          log.info('Fresh install cancelled')
          process.exit(ExitCode.Success)
        }
      }

      const perf = await intro('buddy fresh')
      const result = await runAction(Action.Fresh, {
        ...options,
        stdout: 'inherit',
      })

      if (result.isErr) {
        await outro(
          'While running `buddy fresh`, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro('Freshly reinstalled your dependencies', {
        startTime: perf,
        useSeconds: true,
      })
      process.exit(ExitCode.Success)
    })

  onUnknownSubcommand(buddy, "fresh")
}
