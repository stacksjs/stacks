import process from 'node:process'
import type { CLI, FreshOptions } from 'src/types/src'
import { runCommit } from '@stacksjs/actions'

export function commit(buddy: CLI) {
  const descriptions = {
    commit: 'Commit your stashed changes',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('commit', descriptions.commit)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: FreshOptions) => {
      await runCommit(options)
    })

  buddy.on('commit:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
