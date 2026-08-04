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

/**
 * Render the stx conformance report and own the exit code.
 *
 * Baselines come from `config/lint.ts`. Dropping BELOW one is a failure too:
 * the count is stale, and a ratchet that only ever loosens is theatre. When
 * that happens the new numbers are printed ready to paste back, rather than
 * having the linter rewrite a config file underneath the author.
 */
async function runStxChecks(startTime: number): Promise<void> {
  const { runStxLint } = await import('@stacksjs/actions')
  const report = await runStxLint()

  // One buffer, one write: `log.*` is async and `console.log` is not, so
  // interleaving them detaches every heading from the list it introduces.
  const out: string[] = ['']
  for (const r of report.results) {
    if (r.status === 'fail') {
      out.push(`  FAIL  ${r.label}`)
      out.push(`        ${r.count} found, baseline ${r.baseline}${r.why ? ` (${r.why})` : ''}`)
      for (const line of r.detail.slice(0, 8)) out.push(`          ${line}`)
    }
    else if (r.status === 'loosened') {
      out.push(`  DROP  ${r.label}: ${r.count} < baseline ${r.baseline} — lower it in config/lint.ts`)
    }
    else {
      out.push(`  ok    ${r.label}${r.baseline > 0 ? `  (${r.count}, held)` : ''}`)
    }
  }

  if (report.distMissing)
    out.push('', '  note: no build output found — the dist checks did not run. Run `./buddy build` first.')

  if (report.loosened > 0) {
    out.push('', '  Current counts, for config/lint.ts:')
    for (const [id, count] of Object.entries(report.counts).sort(([a], [b]) => a.localeCompare(b)))
      out.push(`      '${id}': ${count},`)
  }

  // eslint-disable-next-line no-console
  console.log(out.join('\n'))

  if (report.failed > 0) {
    log.error(`${report.failed} stx check(s) failed.`)
    await outro('stx checks failed', { startTime, useSeconds: true })
    process.exit(ExitCode.FatalError)
  }

  if (report.loosened > 0) {
    log.warn(`No regressions, but ${report.loosened} baseline(s) are now stale.`)
    await outro('stx baselines stale', { startTime, useSeconds: true })
    process.exit(ExitCode.FatalError)
  }

  await outro('All stx checks pass', { startTime, useSeconds: true })
}

export function lint(buddy: CLI): void {
  const descriptions = {
    lint: 'Automagically lints your project codebase',
    lintFix: 'Automagically fixes all lint errors',
    format: 'Format your project codebase',
    formatCheck: 'Check formatting without making changes',
    project: 'Target a specific project',
    stx: 'Run the stx conformance checks instead of code style',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('lint', descriptions.lint)
    .option('-f, --fix', descriptions.lintFix, { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--stx', descriptions.stx, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: LintOptions & { stx?: boolean }) => {
      log.debug('Running `buddy lint` ...', options)

      const startTime = await intro('buddy lint')

      if (options.stx) {
        await runStxChecks(startTime)
        return
      }

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
