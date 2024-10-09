import type { CLI, TinkerOptions } from '@stacksjs/types'
import process from 'node:process'
import { intro, log, outro, runCommand } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'

export function tinker(buddy: CLI): void {
  const descriptions = {
    tinker: 'Tinker with your code',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('tinker', descriptions.tinker)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: TinkerOptions) => {
      log.debug('Running `buddy tinker` ...', options)

      const perf = await intro('buddy tinker')
      const result = await runCommand('bun repl', {
        stdin: 'inherit',
      })

      if (result.isErr()) {
        await outro(
          'While running the tinker command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error || undefined,
        )
        process.exit()
      }

      await outro('Tinker mode exited.', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy.on('tinker:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
