import { type CLI, type FreshOptions } from '@stacksjs/types'
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
}
