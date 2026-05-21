/**
 * Migrator registry — used by `./buddy migrate:project` (stacksjs/stacks#1241).
 */

import type { Driver, MigrationReport, MigrateProjectRequest } from './types'
import { laravelDriver } from './laravel'
import { railsDriver } from './rails'

export const DRIVERS: Record<string, Driver> = {
  laravel: laravelDriver,
  rails: railsDriver,
}

export async function runMigrator(req: MigrateProjectRequest): Promise<MigrationReport> {
  const driver = DRIVERS[req.from]
  if (!driver) throw new Error(`Unknown source framework: ${req.from}. Supported: ${Object.keys(DRIVERS).join(', ')}`)

  const startedAt = new Date().toISOString()
  const entries = await driver.migrate(req)
  const finishedAt = new Date().toISOString()

  return {
    source: req.source,
    target: req.target,
    from: req.from,
    startedAt,
    finishedAt,
    entries,
  }
}

/**
 * Render a migration report as a Markdown checklist suitable for
 * writing to `MIGRATION_REPORT.md` in the target project.
 */
export function renderReport(report: MigrationReport): string {
  const lines: string[] = []
  lines.push(`# Migration report — ${report.from} → Stacks`)
  lines.push('')
  lines.push(`- **Source**: \`${report.source}\``)
  lines.push(`- **Target**: \`${report.target}\``)
  lines.push(`- **Started**: ${report.startedAt}`)
  lines.push(`- **Finished**: ${report.finishedAt}`)
  lines.push('')

  const groups = groupEntriesByStatus(report.entries)
  for (const [status, label] of [
    ['translated', 'Translated'],
    ['copied', 'Copied verbatim'],
    ['skipped', 'Skipped (hand-port required)'],
    ['failed', 'Failed'],
  ] as const) {
    const group = groups[status] ?? []
    if (group.length === 0) continue
    lines.push(`## ${label} (${group.length})`)
    lines.push('')
    for (const e of group) {
      const arrow = e.target ? ` → \`${e.target}\`` : ''
      const note = e.note ? ` — ${e.note}` : ''
      lines.push(`- \`${e.source}\`${arrow}${note}`)
    }
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push('Re-run `./buddy migrate:project <name> --from=' + report.from + '` after fixing the source project to refresh emitted files. Translated outputs are overwritten; skipped entries are not.')
  return lines.join('\n')
}

function groupEntriesByStatus(entries: MigrationReport['entries']) {
  const out: Partial<Record<MigrationReport['entries'][number]['status'], MigrationReport['entries']>> = {}
  for (const e of entries) {
    if (!out[e.status]) out[e.status] = []
    out[e.status]!.push(e)
  }
  return out
}

export type { MigrateProjectRequest, MigrationReport, ReportEntry } from './types'
