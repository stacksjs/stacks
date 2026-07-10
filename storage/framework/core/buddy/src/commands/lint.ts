import type { CLI, LintOptions } from '@stacksjs/types'
import process from 'node:process'
import { intro, log, onUnknownSubcommand, outro } from "@stacksjs/cli"
import { ExitCode } from '@stacksjs/types'

/**
 * Run a code-style action from `@stacksjs/actions`. The package's export
 * conditions resolve to its TS source in a vendored monorepo and to its built
 * output from node_modules, so a single clean import works in both layouts —
 * no reaching into `dist/`, and the action drives pickier through its SDK
 * rather than spawning `bunx pickier`. Exits non-zero on failure so the
 * commands drop straight into CI.
 */
async function runStyleAction(
  entry: 'lintProject' | 'lintFix' | 'formatProject',
  label: string,
  options?: { write?: boolean, check?: boolean },
): Promise<void> {
  const actions = await import('@stacksjs/actions')
  const { ok } = await actions[entry](options as never)
  if (!ok) {
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

      await runStyleAction(options.fix ? 'lintFix' : 'lintProject', 'lint')

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
      await runStyleAction('lintFix', 'lint:fix')

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

      await runStyleAction('formatProject', 'format', options.check ? { check: true } : { write: true })

      await outro('Formatted your project', { startTime, useSeconds: true })
    })

  buddy
    .command('format:check', descriptions.formatCheck)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: LintOptions) => {
      log.debug('Running `buddy format:check` ...', options)

      const startTime = await intro('buddy format:check')

      await runStyleAction('formatProject', 'format:check', { check: true })

      await outro('Format check complete', { startTime, useSeconds: true })
    })

  onUnknownSubcommand(buddy, "lint")
}
