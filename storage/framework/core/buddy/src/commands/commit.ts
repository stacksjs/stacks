import type { CLI, FreshOptions } from '@stacksjs/types'
import process from 'node:process'
import { runCommit } from '@stacksjs/actions'
import { log } from '@stacksjs/logging'

export function commit(buddy: CLI): void {
  const descriptions = {
    commit: 'Commit your stashed changes',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('commit', descriptions.commit)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: FreshOptions) => {
      log.debug('Running `buddy commit` ...', options)
      await runCommit(options)
    })

  buddy.on('commit:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
