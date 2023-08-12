import { type CLI } from '@stacksjs/types'
import { runPreinstall } from '@stacksjs/actions'

export function preinstall(buddy: CLI) {
  const descriptions = {
    command: 'Run your preinstall script',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('preinstall', descriptions.command)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(() => {
      runPreinstall()
    })
}
