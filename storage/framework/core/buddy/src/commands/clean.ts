import type { CleanOptions, CLI } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, log, onUnknownSubcommand, outro } from "@stacksjs/cli"
import { hasTTY, isCI } from '@stacksjs/env'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'

export function clean(buddy: CLI): void {
  const descriptions = {
    clean: 'Removes all node_modules & lock files',
    project: 'Target a specific project',
    force: 'Skip the confirmation prompt (required in CI/non-interactive shells)',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('clean', descriptions.clean)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('-f, --force', descriptions.force, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CleanOptions) => {
      log.debug('Running `buddy clean` ...', options)

      // `--force` (or the legacy CLI-level bypasses) skips the confirmation.
      const skipConfirm = options.force === true
        || Boolean((buddy as unknown as Record<string, unknown>).isForce)
        || Boolean((buddy as unknown as Record<string, unknown>).isNoInteraction)

      // Safety guard (stacksjs/stacks#2002): in a non-interactive shell (CI,
      // piped stdin) the confirm prompt below has no one to answer it. Fail
      // fast and name the bypass flag instead of stalling the pipeline.
      if (!skipConfirm && (isCI || !hasTTY || !process.stdin.isTTY)) {
        log.syncError('Refusing to run `buddy clean` from a non-interactive shell without confirmation.')
        log.fatal('   ➡️  Re-run with `--force` to proceed: `buddy clean --force`')
      }

      // Check if confirmation is needed (not forced and not no-interaction mode)
      if (!skipConfirm) {
        const { confirm } = await import('@stacksjs/cli')
        const confirmed = await confirm({
          message: 'This will remove all node_modules and lock files. Continue?',
          initial: false,
        })

        if (!confirmed) {
          log.info('Clean cancelled')
          process.exit(ExitCode.Success)
        }
      }

      const perf = await intro('buddy clean')
      const result = await runAction(Action.Clean, options)

      if (result.isErr) {
        await outro(
          'While running the clean command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro('Cleaned up', {
        startTime: perf,
        useSeconds: true,
        message: 'Cleaned up',
      })
      process.exit(ExitCode.Success)
    })

  onUnknownSubcommand(buddy, "clean")
}
