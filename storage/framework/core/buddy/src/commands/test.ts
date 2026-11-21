import type { CLI, TestingOptions } from '@stacksjs/types'
import process from 'node:process'
import { runAction } from '@stacksjs/actions/run-action'
import { intro, log, onUnknownSubcommand, outro } from "@stacksjs/cli"
import { Action } from '@stacksjs/enums'
import { projectPath } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import { resultFailed } from '../result'

/**
 * The environment the test actions read their named paths from.
 *
 * `buddy test <path>` used to accept the path, discard it and run the whole
 * suite, so a named failing file printed `0 fail` and exited 0
 * (stacksjs/stacks#2973). JSON in the environment rather than a flag because
 * `buddyOptionArgs` comma-joins an array into a single argv value.
 */
function testPathEnv(paths: string[] | undefined): { STACKS_TEST_PATHS: string } | undefined {
  return paths?.length ? { STACKS_TEST_PATHS: JSON.stringify(paths) } : undefined
}

/** What the command covered, so a caller who named paths is told. */
function scopedTests(label: string, paths: string[] | undefined): string {
  if (!paths?.length)
    return label
  return `${label} for ${paths.length === 1 ? paths[0] : `${paths.length} paths`}`
}

export function test(buddy: CLI): void {
  const descriptions = {
    command: 'Runs your test suite',
    types: 'Typechecks your codebase',
    coverage: 'Generates a test coverage report',
    ui: 'Runs your test suite in the browser',
    unit: 'Runs your unit tests',
    feature: 'Runs your feature tests',
    showReport: 'Show the test report',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('test [...paths]', descriptions.command)
    .option('-f, --feature', descriptions.feature, { default: false })
    .option('-u, --unit', descriptions.unit, { default: false })
    // .option('--ui', descriptions.ui, { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: true })
    .example('buddy test')
    .example('buddy test tests/unit/auth.test.ts')
    .example('buddy test storage/framework/core/scheduler/tests')
    .action(async (paths: string[] | undefined, options: TestingOptions) => {
      const perf = await intro('buddy test')
      const env = testPathEnv(paths)

      if (options.feature && options.unit) {
        const result = await runAction(Action.Test, {
          ...options,
          cwd: projectPath(),
          env,
        })

        if (resultFailed(result)) {
          await outro(
            'While running `buddy test`, there was an issue',
            { startTime: perf, useSeconds: true },
            result.error,
          )
          process.exit(ExitCode.FatalError)
        }
      }

      if (options.feature && !options.unit) {
        log.info('Running Feature tests...')

        const result = await runAction(Action.TestFeature, {
          ...options,
          cwd: projectPath(),
          env,
        })

        if (resultFailed(result)) {
          await outro(
            'While running `buddy test`, there was an issue',
            { startTime: perf, useSeconds: true },
            result.error,
          )
          process.exit(ExitCode.FatalError)
        }
      }

      if (!options.feature && options.unit) {
        log.info('Running Unit tests...')

        const result = await runAction(Action.TestUnit, {
          ...options,
          cwd: projectPath(),
          env,
        })

        if (resultFailed(result)) {
          await outro(
            'While running `buddy test`, there was an issue',
            { startTime: perf, useSeconds: true },
            result.error,
          )
          process.exit(ExitCode.FatalError)
        }
      }

      if (!options.feature && !options.unit) {
        const result = await runAction(Action.Test, {
          ...options,
          cwd: projectPath(),
          env,
        })

        if (resultFailed(result)) {
          await outro(
            'While running `buddy test`, there was an issue',
            { startTime: perf, useSeconds: true },
            result.error,
          )
          process.exit(ExitCode.FatalError)
        }
      }

      await outro(scopedTests('Finished running tests', paths), {
        startTime: perf,
        useSeconds: true,
      })
      // Explicit success exit so CI pipelines see a deterministic 0
      // instead of relying on the implicit "no thrown error" exit code.
      process.exit(ExitCode.Success)
    })

  buddy
    .command('test:unit [...paths]', descriptions.unit)
    .option('--verbose', descriptions.verbose, { default: false })
    .example('buddy test:unit')
    .example('buddy test:unit tests/unit/auth.test.ts')
    .action(async (paths: string[] | undefined, options: TestingOptions) => {
      const perf = await intro('buddy test:unit')
      const result = await runAction(Action.TestUnit, {
        ...options,
        verbose: true,
        cwd: projectPath(),
        env: testPathEnv(paths),
      })

      if (resultFailed(result)) {
        await outro(
          'While running `buddy test:unit`, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro(scopedTests('Finished running unit tests', paths), {
        startTime: perf,
        useSeconds: true,
      })
    })

  buddy
    .command('test:feature [...paths]', descriptions.feature)
    .option('--verbose', descriptions.verbose, { default: false })
    .example('buddy test:feature')
    .example('buddy test:feature tests/feature/login.test.ts')
    .action(async (paths: string[] | undefined, options: TestingOptions) => {
      const perf = await intro('buddy test:feature')
      const result = await runAction(Action.TestFeature, {
        ...options,
        verbose: true,
        cwd: projectPath(),
        env: testPathEnv(paths),
      })

      if (resultFailed(result)) {
        await outro(
          'While running `buddy test:feature`, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro(scopedTests('Finished running feature tests', paths), {
        startTime: perf,
        useSeconds: true,
      })
    })

  buddy
    .command('test:ui', descriptions.command)
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: TestingOptions) => {
      const perf = await intro('buddy test:ui')
      const result = await runAction(Action.TestUi, {
        ...options,
        verbose: true,
        cwd: projectPath(),
      })

      if (resultFailed(result)) {
        await outro(
          'While running `buddy test:ui`, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro('Finished running tests in the browser', {
        startTime: perf,
        useSeconds: true,
      })
    })

  buddy
    .command('test:types', descriptions.types)
    .alias('typecheck')
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: TestingOptions) => {
      const perf = await intro('buddy test:types')
      const result = await runAction(Action.Typecheck, {
        ...options,
        verbose: true,
        cwd: projectPath(),
      })

      if (resultFailed(result)) {
        await outro(
          'While running `buddy test:types`, there was an issue',
          { startTime: perf, useSeconds: true },
          result.error,
        )
        process.exit(ExitCode.FatalError)
      }

      await outro('Finished running typecheck', {
        startTime: perf,
        useSeconds: true,
      })
    })

  buddy
    .command('test:page-audit', 'Loads pages in headless Chrome and reports duplicate API requests, failed requests and console errors')
    .option('--url <urls>', 'Page URLs to audit, comma-separated (paths resolve against --base)')
    .option('--base [base]', 'Origin that paths in --url resolve against', { default: 'http://localhost:3000' })
    .option('--quiet-ms [ms]', 'How long the network must stay quiet before a page counts as loaded', { default: 1000 })
    .option('--timeout [ms]', 'Give up waiting for a page to settle after this long', { default: 15000 })
    .option('--mobile', 'Audit at a 390px phone viewport instead of 1440px', { default: false })
    .option('--json', 'Print the reports as JSON', { default: false })
    .option('--lighthouse', 'Also measure Performance, Accessibility, Best Practices and SEO with Lighthouse', { default: false })
    .option('--sitemap <file>', 'Audit every page in a local sitemap on --base')
    .option('--device <device>', 'Lighthouse profile: mobile, desktop or both', { default: 'both' })
    .option('--basic-auth', 'Authenticate on --base using STACKS_AUDIT_USERNAME and STACKS_AUDIT_PASSWORD', { default: false })
    .option('--min-score <score>', 'Required Lighthouse score in every category, from 0 to 100', { default: 100 })
    .option('--output <directory>', 'Directory for Lighthouse JSON, HTML and summary reports', { default: 'storage/framework/testing/lighthouse' })
    .example('buddy test:page-audit --url /,/dashboard --base http://localhost:3000')
    .example('buddy test:page-audit --url http://localhost:3000/pricing --json')
    .example('buddy test:page-audit --lighthouse --sitemap public/sitemap.xml --base http://localhost:3000 --min-score 100')
    .action(async (options: { url?: string, base?: string, quietMs?: number | string, timeout?: number | string, mobile?: boolean, json?: boolean, lighthouse?: boolean, sitemap?: string, device?: string, minScore?: number | string, output?: string, basicAuth?: boolean }) => {
      const { auditLighthouse, basicAuditOrigin, formatLighthouseResult, lighthouseTargets } = await import('@stacksjs/testing/lighthouse')
      const base = options.base || 'http://localhost:3000'
      const username = process.env.STACKS_AUDIT_USERNAME
      const password = process.env.STACKS_AUDIT_PASSWORD
      let targets: string[]
      let authOrigin: string | undefined
      try {
        targets = await lighthouseTargets(options)
        if (options.basicAuth) {
          authOrigin = basicAuditOrigin(base, targets)
          if (!username || !password) throw new TypeError('Set STACKS_AUDIT_USERNAME and STACKS_AUDIT_PASSWORD for --basic-auth')
          // Chrome and Lighthouse only need Chrome's auth cache.
          delete process.env.STACKS_AUDIT_USERNAME
          delete process.env.STACKS_AUDIT_PASSWORD
        }
        if (options.lighthouse) {
          if (!['mobile', 'desktop', 'both'].includes(options.device || 'both')) throw new TypeError('Choose mobile, desktop or both')
          const minimum = Number(options.minScore ?? 100)
          if (!Number.isFinite(minimum) || minimum < 0 || minimum > 100) throw new TypeError('Minimum score must be between 0 and 100')
        }
      }
      catch (error) {
        await log.error(error instanceof Error ? error.message : String(error))
        process.exit(ExitCode.InvalidArgument)
      }
      const { auditPage, formatPageAudit, installBasicAuth, launch, pageAuditClean } = await import('@stacksjs/testing/browser')
      const viewport = options.mobile ? { width: 390, height: 844, mobile: true, deviceScaleFactor: 2 } : { width: 1440, height: 900 }
      // This one-shot command exits immediately. Await disposal of its Chrome
      // profile instead of leaving the shared browser's reuse timer pending.
      const { cdp, close, port } = await launch({ viewport, shared: false })
      const reports = []
      let lighthouse: Awaited<ReturnType<typeof auditLighthouse>> = []
      try {
        if (authOrigin) await installBasicAuth(cdp, authOrigin, username!, password!)
        for (const target of targets) {
          const url = new URL(target, base).href
          const report = await auditPage(url, { cdp, quietMs: Number(options.quietMs) || 1000, timeoutMs: Number(options.timeout) || 15000 })
          reports.push(report)
          if (!options.json) await log.info(formatPageAudit(report))
        }
        if (!authOrigin) await close()
        if (options.lighthouse) {
          // Keep the HTTP auth cache, but stop the audited page's timers and network activity.
          if (authOrigin) await cdp.send('Page.navigate', { url: 'about:blank' })
          lighthouse = await auditLighthouse({
            urls: targets,
            outputDir: options.output || projectPath('storage/framework/testing/lighthouse'),
            device: options.device as 'mobile' | 'desktop' | 'both', minimum: Number(options.minScore ?? 100),
            chromePort: authOrigin ? port : undefined,
            onResult: result => { if (!options.json) process.stdout.write(`${formatLighthouseResult(result)}\n`) },
          })
        }
      }
      finally {
        await close()
      }
      if (options.json) process.stdout.write(`${JSON.stringify(options.lighthouse ? { pages: reports, lighthouse } : reports, null, 2)}\n`)
      process.exit(reports.every(pageAuditClean) && lighthouse.every(result => result.passed) ? ExitCode.Success : ExitCode.FatalError)
    })

  onUnknownSubcommand(buddy, "test")
}
