import type { CLI, ProjectsOptions } from '@stacksjs/types'
import process from 'node:process'
import { intro, log } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'
import { findStacksProjects } from '@stacksjs/utils'

export function projects(buddy: CLI): void {
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

      for (const project of projects) console.log('   - ', project)

      process.exit(ExitCode.Success)
    })

  buddy
    .command('projects:list', descriptions.projects)
    .option('-q, --quiet', 'Use minimal output', { default: false })
    .option('-l, --list', 'List all local Stacks projects', { default: true })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: ProjectsOptions) => {
      log.debug('Running `buddy projects` ...', options)

      if (!options.quiet)
        await intro('buddy projects:list')

      // uses os.homedir() as the default path
      const projects = await findStacksProjects(undefined, options)

      for (const project of projects) console.log('   - ', project)

      process.exit(ExitCode.Success)
    })

  buddy.on('projects:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
