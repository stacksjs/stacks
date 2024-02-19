import process from 'node:process'
import { ExitCode } from '@stacksjs/types'
import type { CLI, CliOptions } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'
import { intro, log, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'

export function findProjects(buddy: CLI) {
  const descriptions = {
    findProjects: 'Find all Stacks projects on your system',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('find-projects', descriptions.findProjects)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliOptions) => {
      log.debug('Running `buddy find-projects` ...', options)

      const perf = await intro('buddy find-projects')
      const result = await runAction(Action.FindProjects, options)

      if (result.isErr()) {
        await outro('While running the find-projects command, there was an issue', { startTime: perf, useSeconds: true }, result.error)
        process.exit(ExitCode.FatalError)
      }

      process.exit(ExitCode.Success)
    })

  buddy.on('find-projects:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
