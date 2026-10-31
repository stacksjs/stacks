import type { CLI } from '@stacksjs/types'
import { resolve } from 'node:path'
import process from 'node:process'
import { intro, log, onUnknownSubcommand, outro } from "@stacksjs/cli"
import { projectPath } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'

interface SecurityScanOptions {
  only?: string
  skip?: string
  json?: boolean
  failOn?: string
  offline?: boolean
  showIgnored?: boolean
  path?: string
}

const SEVERITY_NAMES = ['critical', 'high', 'medium', 'low', 'none']

/** `a,b` → ['a', 'b'], each checked against the known names. */
function parseChecks(value: string | undefined, flag: string, known: readonly string[]): string[] | undefined {
  if (!value) return undefined
  const names = value.split(',').map(name => name.trim().toLowerCase()).filter(Boolean)
  const unknown = names.filter(name => !known.includes(name))
  if (unknown.length) throw new Error(`${flag}: unknown check ${unknown.map(name => `"${name}"`).join(', ')}. Choose from ${known.join(', ')}.`)
  return names
}

export function security(buddy: CLI): void {
  const descriptions = {
    scan: 'Scan the project for security vulnerabilities: vulnerable dependencies, committed secrets, dangerous code, risky GitHub workflows and repository hygiene',
    only: 'Run only these checks, comma-separated: dependencies, secrets, code, workflows, hygiene',
    skip: 'Skip these checks, comma-separated',
    json: 'Print the report as JSON',
    failOn: 'Exit non-zero for findings at or above this severity: critical, high, medium, low or none',
    offline: 'Do not use the network (skips the dependency advisory check)',
    showIgnored: 'List the findings that .security-ignore.json or a security-ignore comment set aside',
    path: 'Scan this directory instead of the project',
  }

  buddy
    .command('security:scan', descriptions.scan)
    .alias('audit')
    .option('--only <checks>', descriptions.only)
    .option('--skip <checks>', descriptions.skip)
    .option('--json', descriptions.json, { default: false })
    .option('--fail-on <severity>', descriptions.failOn, { default: 'high' })
    .option('--offline', descriptions.offline, { default: false })
    .option('--show-ignored', descriptions.showIgnored, { default: false })
    .option('--path <dir>', descriptions.path)
    .example('buddy security:scan')
    .example('buddy security:scan --only dependencies,secrets')
    .example('buddy security:scan --fail-on medium --json')
    .action(async (options: SecurityScanOptions) => {
      log.debug('Running `buddy security:scan` ...', options)
      const { failsScan, formatScan, runSecurityScan, SCAN_CHECKS } = await import('@stacksjs/security/scan')
      const failOn = String(options.failOn ?? 'high').toLowerCase()
      if (!SEVERITY_NAMES.includes(failOn)) {
        await log.error(`--fail-on: unknown severity "${failOn}". Choose from ${SEVERITY_NAMES.join(', ')}.`)
        process.exit(ExitCode.InvalidArgument)
      }
      let only: string[] | undefined
      let skip: string[] | undefined
      try {
        only = parseChecks(options.only, '--only', SCAN_CHECKS)
        skip = parseChecks(options.skip, '--skip', SCAN_CHECKS)
      }
      catch (error) {
        await log.error(error instanceof Error ? error.message : String(error))
        process.exit(ExitCode.InvalidArgument)
      }

      const startTime = options.json ? 0 : await intro('buddy security:scan')
      const report = await runSecurityScan({
        cwd: options.path ? resolve(options.path) : projectPath(),
        only: only as never,
        skip: skip as never,
        offline: Boolean(options.offline),
      })
      const failed = failsScan(report, failOn as never)

      if (options.json) {
        process.stdout.write(`${JSON.stringify({ ...report, failOn, passed: !failed }, null, 2)}\n`)
        process.exit(failed ? ExitCode.FatalError : ExitCode.Success)
      }

      // eslint-disable-next-line no-console
      console.log(formatScan(report, { color: process.stdout.isTTY, showIgnored: Boolean(options.showIgnored) }))
      if (failed) {
        await outro(`Security scan failed (${failOn} or worse)`, { startTime, useSeconds: true, type: 'error' })
        process.exit(ExitCode.FatalError)
      }
      await outro('Security scan passed', { startTime, useSeconds: true })
    })

  onUnknownSubcommand(buddy, 'security')
}
