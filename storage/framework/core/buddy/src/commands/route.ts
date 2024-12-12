import type { CLI, MigrateOptions } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'

export function route(buddy: CLI): void {
  const descriptions = {
    route: 'Lists your routes',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('route:list', descriptions.route)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: MigrateOptions) => {
      const perf = await intro('buddy route:list')
      const result = await runAction(Action.RouteList, options)

      if (result.isErr()) {
        await outro(
          'While running the migrate command, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit()
      }

      await outro(`Successfully listed routes`)

      process.exit(ExitCode.Success)
    })

  buddy.on('route:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
