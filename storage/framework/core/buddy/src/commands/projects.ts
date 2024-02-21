import process from 'node:process'
import { ExitCode } from '@stacksjs/types'
import type { CLI, ProjectsOptions } from '@stacksjs/types'
import { intro, log } from '@stacksjs/cli'
import { findStacksProjects } from 'stacks/utils'

export function projects(buddy: CLI) {
  const descriptions = {
    projects: 'Find all Stacks projects on your system',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('projects', descriptions.projects)
    .option('-q, --quiet', 'Use minimal output', { default: false })
    .option('-l, --list', 'List all local Stacks projects', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: ProjectsOptions) => {
      log.debug('Running `buddy projects` ...', options)

      if (!options.quiet)
        await intro('buddy projects')

      const projects = await findStacksProjects(undefined, options)

      for (const project of projects)
        // eslint-disable-next-line no-console
        console.log('   - ', project)

      process.exit(ExitCode.Success)
    })

  buddy
    .command('projects:list', descriptions.projects)
    .option('-q, --quiet', 'Use minimal output', { default: false })
    .option('-l, --list', 'List all local Stacks projects', { default: true })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: ProjectsOptions) => {
      log.debug('Running `buddy projects` ...', options)

      await intro('buddy projects:list')

      if (!options.quiet)
        await intro('buddy projects')

      const projects = await findStacksProjects(undefined, options)

      for (const project of projects)
        // eslint-disable-next-line no-console
        console.log('   - ', project)

      process.exit(ExitCode.Success)
    })

  buddy.on('projects:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
