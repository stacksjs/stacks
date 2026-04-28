import type { CLI, LintOptions } from '@stacksjs/types'
import process from 'node:process'
import { intro, log, outro, runCommand } from '@stacksjs/cli'
import { path } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'

/**
 * Treat a runCommand Result as a CI/CD-friendly status: any failure (exec
 * error or non-zero exit code from the underlying child) translates into
 * `process.exit(FatalError)` so `buddy lint` can be wired into CI without
 * having to remember to wrap `--ci` flags. Previously a non-zero exit from
 * pickier was silently dropped and the parent process always exited 0.
 */
function exitOnFailure(result: Awaited<ReturnType<typeof runCommand>>, label: string): void {
  if (result && typeof result === 'object' && 'isErr' in result && (result as { isErr?: () => boolean }).isErr?.()) {
    log.error(`${label} reported failure`)
    process.exit(ExitCode.FatalError)
  }
}

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

      const result = options.fix
        ? await runCommand('bunx --bun pickier run --mode lint --config ./pickier.config.ts --fix', { cwd: path.projectPath() })
        : await runCommand('bunx --bun pickier run --mode lint --config ./pickier.config.ts', { cwd: path.projectPath() })
      exitOnFailure(result, 'lint')

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
      const result = await runCommand('bunx --bun pickier run --mode lint --config ./pickier.config.ts --fix', { cwd: path.projectPath() })
      exitOnFailure(result, 'lint:fix')

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

      const result = options.check
        ? await runCommand('bunx --bun pickier run --mode format --config ./pickier.config.ts --check', { cwd: path.projectPath() })
        : await runCommand('bunx --bun pickier run --mode format --config ./pickier.config.ts --write', { cwd: path.projectPath() })
      exitOnFailure(result, 'format')

      await outro('Formatted your project', { startTime, useSeconds: true })
    })

  buddy
    .command('format:check', descriptions.formatCheck)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: LintOptions) => {
      log.debug('Running `buddy format:check` ...', options)

      const startTime = await intro('buddy format:check')

      const result = await runCommand('bunx --bun pickier run --mode format --config ./pickier.config.ts --check', { cwd: path.projectPath() })
      exitOnFailure(result, 'format:check')

      await outro('Format check complete', { startTime, useSeconds: true })
    })

  buddy.on('lint:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
