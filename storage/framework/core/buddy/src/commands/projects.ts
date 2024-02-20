import process from 'node:process'
import { ExitCode } from '@stacksjs/types'
import type { CLI, ProjectsOptions } from '@stacksjs/types'
import { runAction } from '@stacksjs/actions'
import { intro, log, outro } from '@stacksjs/cli'
import { Action } from '@stacksjs/enums'

export function findProjects(buddy: CLI) {
  const descriptions = {
    projects: 'Find all Stacks projects on your system',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('projects', descriptions.projects)
    .option('-l, --list', 'List all local Stacks projects', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: ProjectsOptions) => {
      log.debug('Running `buddy projects` ...', options)

      const perf = await intro('buddy projects')
      const result = await runAction(Action.FindProjects, options)

      if (result.isErr()) {
        await outro('While running the projects command, there was an issue', { startTime: perf, useSeconds: true }, result.error)
        process.exit(ExitCode.FatalError)
      }

      process.exit(ExitCode.Success)
    })

  buddy
    .command('projects:list', descriptions.projects)
    .option('-l, --list', 'List all local Stacks projects', { default: true })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: ProjectsOptions) => {
      log.debug('Running `buddy projects` ...', options)

      const perf = await intro('buddy projects:list')
      const result = await runAction(Action.FindProjects, options)

      if (result.isErr()) {
        await outro('While running the projects:list command, there was an issue', { startTime: perf, useSeconds: true }, result.error)
        process.exit(ExitCode.FatalError)
      }

      process.exit(ExitCode.Success)
    })

  buddy.on('projects:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
