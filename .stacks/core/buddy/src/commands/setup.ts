import { runCommand } from '@stacksjs/cli'
import type { CLI, CliOptions } from '@stacksjs/types'

async function setup(buddy: CLI) {
  const descriptions = {
    ensure: 'This command checks whether Node is installed. pnpm is checked via `only-allow` preinstall hook',
    setup: 'This command installs Node & pnpm',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('ensure', descriptions.ensure)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliOptions) => {
      await runCommand('pnpm install', options)
    })

  buddy
    .command('setup', descriptions.setup)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CliOptions) => {
      await runCommand('pnpm env use', options)
    })
}

export { setup }
