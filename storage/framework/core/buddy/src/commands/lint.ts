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
    lintStx: 'Run the stx conformance gate against your templates and build output',
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

  // `buddy lint:stx` — the stx conformance gate.
  //
  // Chapter 12 of the stx standards, plus three checks that read `dist/`. Those
  // last three exist because a real bug shipped past every source-level gate: a
  // mis-resolved component put an error string where the sidebar should have
  // been on every built page, so the app shipped with no navigation and the
  // developer's home directory in the HTML, and the build still exited 0.
  //
  // A ratchet, not a cliff. Counts are compared against `.stx-gate.json`, and
  // dropping BELOW a baseline fails too — a ratchet that only ever loosens is
  // theatre. `--update` rewrites the file.
  buddy
    .command('lint:stx', descriptions.lintStx)
    .option('--update', 'Rewrite .stx-gate.json baselines to the current counts', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: { update?: boolean, verbose?: boolean }) => {
      const startTime = await intro('buddy lint:stx')

      const { runStxGate, STX_GATE_CONFIG_FILE, writeStxGateBaselines } = await import('@stacksjs/actions')
      const report = await runStxGate()

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
          out.push(`  DROP  ${r.label}: ${r.count} < baseline ${r.baseline} — lower it (--update)`)
        }
        else {
          out.push(`  ok    ${r.label}${r.baseline > 0 ? `  (${r.count}, held)` : ''}`)
        }
      }

      if (report.distMissing)
        out.push('', '  note: no build output found — the dist checks did not run. Run `./buddy build` first.')

      // eslint-disable-next-line no-console
      console.log(out.join('\n'))

      if (options.update) {
        await writeStxGateBaselines(report.root, report.nextBaselines)
        log.success(`Wrote current counts to ${STX_GATE_CONFIG_FILE}.`)
        log.info('This belongs in the same diff as the change that cleared the violations, never on its own.')
        await outro('Baselines updated', { startTime, useSeconds: true })
        process.exit(ExitCode.Success)
      }

      if (report.failed > 0) {
        log.error(`${report.failed} gate(s) failed.`)
        await outro('stx gate failed', { startTime, useSeconds: true })
        process.exit(ExitCode.FatalError)
      }

      if (report.loosened > 0) {
        log.warn(`No regressions, but ${report.loosened} baseline(s) are now stale. Re-run with --update.`)
        await outro('stx gate stale', { startTime, useSeconds: true })
        process.exit(ExitCode.FatalError)
      }

      await outro('All stx gates pass', { startTime, useSeconds: true })
    })

  onUnknownSubcommand(buddy, "lint")
}
