import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { intro, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'
import { ExitCode } from '@stacksjs/types'
import type { CLI, MigrateOptions } from '@stacksjs/types'

export function route(buddy: CLI) {
  const descriptions = {
    route: 'Lists your routes',
  }

  buddy
    .command('route:list', descriptions.route)
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
}
