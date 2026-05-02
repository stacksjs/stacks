import type { CLI, FreshOptions } from '@stacksjs/types'
import process from 'node:process'
import { runCommit } from '@stacksjs/actions'
import { log } from '@stacksjs/logging'
import { onUnknownSubcommand } from "@stacksjs/cli"

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

  onUnknownSubcommand(buddy, "commit")
}
