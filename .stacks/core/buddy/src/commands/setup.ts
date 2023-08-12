import { runCommand } from '@stacksjs/cli'
import { type CLI, type CliOptions } from '@stacksjs/types'

export function setup(buddy: CLI) {
  const descriptions = {
    ensure: 'This command checks whether Node is installed. bun is checked via `only-allow` preinstall hook',
    setup: 'This command installs Node & bun',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('ensure', descriptions.ensure)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliOptions) => {
      await runCommand('bun install', options)
    })

  buddy
    .command('setup', descriptions.setup)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliOptions) => {
      await runCommand('bun env use', options)
    })
}
