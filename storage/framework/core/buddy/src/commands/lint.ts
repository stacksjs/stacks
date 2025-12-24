import type { CLI, LintOptions } from '@stacksjs/types'
import process from 'node:process'
import { intro, log, outro, runCommand } from '@stacksjs/cli'
import { path } from '@stacksjs/path'

export function lint(buddy: CLI): void {
  const descriptions = {
    lint: 'Automagically lints your project codebase',
    lintFix: 'Automagically fixes all lint errors',
    format: 'Format your project codebase',
    formatCheck: 'Check formatting without making changes',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('lint', descriptions.lint)
    .option('-f, --fix', descriptions.lintFix, { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: LintOptions) => {
      log.debug('Running `buddy lint` ...', options)

      const startTime = await intro('buddy lint')

      if (options.fix)
        await runCommand('bunx --bun pickier run --mode lint --config ./pickier.config.ts --fix', { cwd: path.projectPath() })
      else
        await runCommand('bunx --bun pickier run --mode lint --config ./pickier.config.ts', { cwd: path.projectPath() })

      await outro('Linted your project', { startTime, useSeconds: true })
    })

  buddy
    .command('lint:fix', descriptions.lintFix)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: LintOptions) => {
      log.debug('Running `buddy lint:fix` ...', options)

      const startTime = await intro('buddy lint:fix')

      log.info('Fixing lint errors...')
      await runCommand('bunx --bun pickier run --mode lint --config ./pickier.config.ts --fix', { cwd: path.projectPath() })

      await outro('Fixed lint errors', { startTime, useSeconds: true })
    })

  buddy
    .command('format', descriptions.format)
    .option('-w, --write', 'Write changes to files', { default: false })
    .option('-c, --check', descriptions.formatCheck, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: LintOptions & { write?: boolean, check?: boolean }) => {
      log.debug('Running `buddy format` ...', options)

      const startTime = await intro('buddy format')

      if (options.check)
        await runCommand('bunx --bun pickier run --mode format --config ./pickier.config.ts --check', { cwd: path.projectPath() })
      else
        await runCommand('bunx --bun pickier run --mode format --config ./pickier.config.ts --write', { cwd: path.projectPath() })

      await outro('Formatted your project', { startTime, useSeconds: true })
    })

  buddy
    .command('format:check', descriptions.formatCheck)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: LintOptions) => {
      log.debug('Running `buddy format:check` ...', options)

      const startTime = await intro('buddy format:check')

      await runCommand('bunx --bun pickier run --mode format --config ./pickier.config.ts --check', { cwd: path.projectPath() })

      await outro('Format check complete', { startTime, useSeconds: true })
    })

  buddy.on('lint:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
