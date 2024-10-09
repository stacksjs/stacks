import type { CLI, CliOptions } from '@stacksjs/types'
import process from 'node:process'
import { generateTypes } from '@stacksjs/actions'
import { log } from '@stacksjs/logging'

export function types(buddy: CLI): void {
  const descriptions = {
    generate: 'Generate the types of & for your library/libraries',
    fix: 'wip',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('types:generate', descriptions.generate)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliOptions) => {
      log.debug('Running `buddy types:generate` ...', options)
      await generateTypes()
    })

  buddy
    .command('types:fix', descriptions.fix)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async () => {
      // await fixTypes()
    })

  buddy.on('types:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
