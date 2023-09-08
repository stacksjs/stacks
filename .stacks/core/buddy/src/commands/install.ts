import type { CLI, InstallOptions } from '@stacksjs/types'
import { runCommand } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'

export function install(buddy: CLI) {
  const descriptions = {
    install: 'Install your dependencies',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('install', descriptions.install)
    .option('-v, --verbose', descriptions.verbose, { default: false })
    .action(async (options: InstallOptions) => {
      await runCommand('bun install', {
        cwd: p.projectPath(),
      })
    })
}
