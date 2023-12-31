import process from 'node:process'
import type { CLI, InstallOptions } from 'src/types/src'
import { runCommand } from 'src/cli/src'
import { path as p } from 'src/path/src'

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
        ...options,
        cwd: p.projectPath(),
      })
    })

  buddy.on('install:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
