import type { CLI, ConflictStrategy } from '@stacksjs/types'
import process from 'node:process'
import { installStack, listStacks, uninstallStack } from '@stacksjs/actions'
import { intro, italic, outro } from '@stacksjs/cli'
import { log } from '@stacksjs/logging'
import { ExitCode } from '@stacksjs/types'

export function stacks(buddy: CLI): void {
  const descriptions = {
    install: 'Install a stack into your project',
    uninstall: 'Uninstall a stack from your project',
    list: 'List available and installed stacks',
    force: 'Force overwrite existing files',
    dryRun: 'Show what would be installed without making changes',
    conflict: 'Conflict resolution strategy: skip, overwrite, or backup',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('stack:install <name>', descriptions.install)
    .option('--force', descriptions.force, { default: false })
    .option('--dry-run', descriptions.dryRun, { default: false })
    .option('--conflict <strategy>', descriptions.conflict, { default: 'skip' })
    .option('--verbose', descriptions.verbose, { default: false })
    .example('buddy stack:install @stacksjs/blog')
    .example('buddy stack:install blog --force')
    .example('buddy stack:install blog --conflict backup --verbose')
    .example('buddy stack:install blog --dry-run')
    .action(async (name: string, options: { force?: boolean, dryRun?: boolean, conflict?: string, verbose?: boolean }) => {
      const perf = await intro('buddy stack:install')

      if (!name) {
        log.error('You need to specify a stack name.')
        log.info('Example: buddy stack:install @stacksjs/blog')
        process.exit(ExitCode.FatalError)
      }

      const result = await installStack({
        name,
        force: options.force,
        dryRun: options.dryRun,
        conflict: (options.conflict as ConflictStrategy) || 'skip',
        verbose: options.verbose,
      })

      if (!result && !options.dryRun) {
        await outro('Failed to install stack', { startTime: perf, useSeconds: true })
        process.exit(ExitCode.FatalError)
      }

      await outro(`Stack ${italic(name)} installed.`, { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('stack:uninstall <name>', descriptions.uninstall)
    .option('--force', descriptions.force, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .example('buddy stack:uninstall blog')
    .example('buddy stack:uninstall blog --force')
    .action(async (name: string, options: { force?: boolean, verbose?: boolean }) => {
      const perf = await intro('buddy stack:uninstall')

      if (!name) {
        log.error('You need to specify a stack name.')
        process.exit(ExitCode.FatalError)
      }

      const result = await uninstallStack({
        name,
        force: options.force,
        verbose: options.verbose,
      })

      if (!result) {
        await outro('Failed to uninstall stack', { startTime: perf, useSeconds: true })
        process.exit(ExitCode.FatalError)
      }

      await outro(`Stack ${italic(name)} uninstalled.`, { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy
    .command('stack:list', descriptions.list)
    .alias('stack:ls')
    .example('buddy stack:list')
    .action(async () => {
      const perf = await intro('buddy stack:list')

      const entries = await listStacks()

      if (entries.length === 0) {
        log.info('No stacks found. Install one with: buddy stack:install <name>')
      }
      else {
        log.info(`Found ${entries.length} stack(s):`)
        log.info('')
        for (const entry of entries) {
          const status = entry.installed ? '[installed]' : '[available]'
          const desc = entry.description ? ` - ${entry.description}` : ''
          const files = entry.fileCount ? ` (${entry.fileCount} files)` : ''
          log.info(`  ${entry.name} ${italic(`v${entry.version}`)} ${status}${files}${desc}`)
        }
      }

      await outro('', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy.on('stack:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
