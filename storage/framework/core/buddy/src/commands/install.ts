import process from 'node:process'
import type { CLI, InstallOptions } from '@stacksjs/types'
import { runCommand } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'

export function install(buddy: CLI) {
  const descriptions = {
    install: 'Install your dependencies',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('install', descriptions.install)
    .option('-p, --project', descriptions.project, { default: false })
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
