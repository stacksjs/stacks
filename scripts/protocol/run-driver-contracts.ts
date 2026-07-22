import { Database } from 'bun:sqlite'
import { mkdirSync, writeFileSync } from 'node:fs'
import { arch, platform } from 'node:os'
import { resolve } from 'node:path'
import type { CapabilityDriver } from '../../storage/framework/core/config/src/capabilities'
import { capabilityRegistry } from '../../storage/framework/core/config/src/capabilities'

const root = resolve(import.meta.dir, '../..')
const reportRoot = resolve(process.env.PROTOCOL_REPORT_DIR || resolve(root, 'protocol/reports'))

export function planDriverContracts(drivers: readonly CapabilityDriver[]): {
  tests: string[]
  records: Array<CapabilityDriver & { execution: 'run' | 'not-run', reason: string | null }>
} {
  const tests = [...new Set(drivers.filter(driver => driver.status === 'supported').flatMap(driver => driver.testEvidence))].sort()
  const records = drivers.map(driver => ({
    ...driver,
    execution: driver.status === 'supported' ? 'run' as const : 'not-run' as const,
    reason: driver.status === 'supported' ? null : `Maturity is ${driver.status}; prerequisites and missing evidence are reported without promotion.`,
  }))
  return { tests, records }
}

function sqliteVersion(): string {
  const database = new Database(':memory:')
  try {
    const row = database.query('select sqlite_version() as version').get() as { version: string }
    return row.version
  }
  finally {
    database.close()
  }
}

function markdown(report: any): string {
  const rows = report.drivers.map((driver: any) =>
    `| ${driver.category} | ${driver.name} | ${driver.maturity} | ${driver.execution} | ${driver.topology} | ${driver.reason || 'Retained test paths passed.'} |`,
  ).join('\n')
  return `# Stacks driver contract matrix\n\n` +
    `- Source: \`${report.sourceRevision}\`\n` +
    `- Runtime: Bun \`${report.environment.runtime.version}\` on \`${report.environment.platform.os}/${report.environment.platform.architecture}\`\n` +
    `- SQLite: \`${report.environment.services.sqlite}\`\n` +
    `- Redis: \`${report.environment.services.redis.version}\` at \`${report.environment.services.redis.topology}\`\n` +
    `- Test files: ${report.testRun.files.length}\n` +
    `- Result: **${report.testRun.status}**\n\n` +
    `| Category | Driver | Maturity | Execution | Topology | Evidence boundary |\n| --- | --- | --- | --- | --- | --- |\n${rows}\n`
}

export function runDriverContracts(): void {
  const plan = planDriverContracts(capabilityRegistry)
  if (!plan.tests.length) throw new Error('No supported driver contracts were selected')
  const revisionResult = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: root })
  if (revisionResult.exitCode !== 0) throw new Error('Could not resolve the Stacks revision')
  const started = performance.now()
  const result = Bun.spawnSync(['bun', 'test', ...plan.tests], { cwd: root, stdout: 'inherit', stderr: 'inherit' })
  const durationMs = Math.round(performance.now() - started)
  const status = result.exitCode === 0 ? 'pass' : 'fail'
  const report = {
    schemaVersion: '1.0.0',
    sourceRevision: revisionResult.stdout.toString().trim(),
    environment: {
      runtime: { name: 'bun', version: Bun.version },
      platform: { os: platform(), architecture: arch() },
      ci: process.env.GITHUB_ACTIONS === 'true' ? 'github-actions' : 'local',
      services: {
        sqlite: sqliteVersion(),
        redis: {
          version: process.env.REDIS_SERVICE_VERSION || 'unreported',
          url: process.env.REDIS_URL ? 'redis://127.0.0.1:6379/0' : 'not provisioned',
          topology: 'single-node loopback process provisioned by Pantry Action',
        },
        otherExternal: 'not provisioned; partial/experimental drivers are not promoted',
      },
    },
    testRun: { status, durationMs, files: plan.tests },
    drivers: plan.records.map(driver => ({
      category: driver.category,
      name: driver.name,
      maturity: driver.status,
      execution: driver.execution === 'run' ? status : driver.execution,
      topology: driver.topology,
      prerequisites: driver.prerequisites,
      evidence: driver.testEvidence,
      limitations: driver.limitations,
      reason: driver.reason,
    })),
  }
  mkdirSync(reportRoot, { recursive: true })
  writeFileSync(resolve(reportRoot, 'driver-matrix.json'), `${JSON.stringify(report, null, 2)}\n`)
  writeFileSync(resolve(reportRoot, 'driver-matrix.md'), markdown(report))
  if (status === 'fail') throw new Error('Supported driver contract tests failed')
  console.log(`Driver contract matrix passed ${plan.tests.length} retained test files`)
}

if (import.meta.main) {
  try {
    runDriverContracts()
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
