import { runCommand } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'
import type { CLI, CliOptions } from '@stacksjs/types'

const descriptions = {
  ensure: 'This command checks whether Node is installed. pnpm is checked via `only-allow` preinstall hook',
  setup: 'This command installs Node & pnpm',
  debug: 'Add additional debug logging',
}

async function setup(stacks: CLI) {
  stacks
    .command('ensure', descriptions.ensure)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: CliOptions) => {
      await runCommand('pnpm install', options)
      process.exit(ExitCode.Success)
    })

  stacks
    .command('setup', descriptions.setup)
    .option('--debug', descriptions.debug, { default: false })
    .action(async (options: CliOptions) => {
      await runCommand('pnpm env use', options)
      process.exit(ExitCode.Success)
    })
}

export { setup }
