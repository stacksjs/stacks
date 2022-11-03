import { runCommand } from '@stacksjs/cli'
import type { CLI, CliOptions } from '@stacksjs/types'

const descriptions = {
  ensure: 'This command checks whether Node is installed. pnpm is checked via `only-allow` preinstall hook',
  setup: 'This command installs Node & pnpm',
  debug: 'Enable debug mode',
}

async function setup(stacks: CLI) {
  stacks
    .command('ensure', descriptions.ensure)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: CliOptions) => {
      await runCommand('pnpm install', options)
    })

  stacks
    .command('setup', descriptions.setup)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: CliOptions) => {
      await runCommand('pnpm env use', options)
    })
}

export { setup }
