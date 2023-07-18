import type { CLI } from '@stacksjs/types'
import { invoke } from '@stacksjs/actions/preinstall'

export async function preinstall(buddy: CLI) {
  const descriptions = {
    command: 'Run your preinstall script',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('preinstall', descriptions.command)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async () => {
      await invoke()
    })
}
