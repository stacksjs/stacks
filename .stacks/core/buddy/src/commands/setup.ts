import { runCommand } from '@stacksjs/cli'
import type { CLI, CliOptions } from '@stacksjs/types'

export function setup(buddy: CLI) {
  const descriptions = {
    ensure: 'This command checks whether Bun is installed. If not, it installs it',
    setup: 'This command installs Bun',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('ensure', descriptions.ensure)
    .option('--verbose', descriptions.verbose, { default: false })
    .action((options: CliOptions) => {
      runCommand('bun install', options)
    })

  buddy
    .command('setup', descriptions.setup)
    .option('--verbose', descriptions.verbose, { default: false })
    .action((options: CliOptions) => {
      runCommand('bun env use', options)
    })
}
