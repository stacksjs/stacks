import type { Model } from '@stacksjs/types'
import fs from 'node:fs'
import { path } from '@stacksjs/path'

/**
 * Does the live database still look like the models?
 *
 * The companion to `fk-audit.ts`, and the one that catches the quieter failure.
 * `migrate` decides what to do by asking which migration FILES have not
 * executed. It never asks whether the database resembles the models. So a
 * database created from an older, wrong migration set reports "nothing to
 * migrate — your database is already up to date" on every run, forever, while
 * its columns are wrong, and a corrected `CREATE TABLE IF NOT EXISTS` deploys
 * as a no-op against it.
 *
 * Two of those reached production on one app: a JSON column left in
 * varchar(255), which refused a large payload, and a money column left as an
 * integer, which stored 99.5 as 100. Every layer reported success. The only
 * symptom was a number that came back different from the one written.
 *
 * The comparison itself lives in bun-query-builder, which owns the schema plan
 * and the introspection. This file's job is the part only the framework knows:
 * where an application's models actually are.
 */

/** One column whose live type does not match what its model declares. */
export interface SchemaDriftColumn {
  table: string
  column: string
  expected: string
  actual: string
  actualSqlType: string
}

export interface SchemaDriftReport {
  missingTables: string[]
  missingColumns: Array<{ table: string, column: string, expected: string }>
  typeMismatches: SchemaDriftColumn[]
  clean: boolean
  /** True when the audit could not run at all, e.g. no models were found. */
  skipped: boolean
}

/**
 * Load every model under a directory.
 *
 * Recursive, and tolerant per file: the built-in models are grouped into
 * subdirectories, and one unreadable model must not cost every other model its
 * audit. Mirrors the loader in relation-columns.ts.
 */
async function loadModelsFrom(dir: string): Promise<Model[]> {
  const out: Model[] = []
  if (!fs.existsSync(dir))
    return out

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      out.push(...(await loadModelsFrom(fullPath)))
      continue
    }

    if (!entry.name.endsWith('.ts') || entry.name.startsWith('_') || entry.name.startsWith('index'))
      continue

    try {
      const imported = (await import(fullPath)).default as Model
      if (imported?.name || imported?.table)
        out.push(imported)
    }
    catch {
      // Per-file failure is non-fatal, same tolerance as the schema codegen.
    }
  }

  return out
}

/**
 * Compare the live schema against the application's models.
 *
 * Only the application's own models under `app/Models/`. The framework defaults
 * are deliberately excluded: an application that does not use the commerce or
 * CMS models has no tables for them, and reporting sixty absent tables would
 * bury the one column that is actually wrong.
 *
 * Never throws. A drift audit that breaks `migrate` is worse than one that does
 * not run, so an introspection failure, a missing permission or an
 * unrecognisable model returns `skipped` and the caller carries on.
 */
export async function auditSchemaDrift(): Promise<SchemaDriftReport> {
  const empty: SchemaDriftReport = {
    missingTables: [],
    missingColumns: [],
    typeMismatches: [],
    clean: true,
    skipped: true,
  }

  try {
    const models = await loadModelsFrom(path.appPath('Models'))
    if (models.length === 0)
      return empty

    // Typed structurally rather than from the package's declarations on
    // purpose. The framework vendors bun-query-builder into `pantry/`, which is
    // refreshed on its own schedule, so this file has to compile and run
    // against a copy that predates these functions. The guard below is the
    // real check; the cast only stops the compiler asserting the opposite.
    const qb = await import('bun-query-builder') as unknown as {
      defineModels: (models: Record<string, unknown>) => unknown
      buildMigrationPlan?: (models: unknown, options: unknown) => unknown
      auditSchemaDrift?: (plan: unknown, options: unknown) => Promise<Omit<SchemaDriftReport, 'skipped'>>
    }

    if (typeof qb.auditSchemaDrift !== 'function' || typeof qb.buildMigrationPlan !== 'function')
      return empty

    const defined = qb.defineModels(
      Object.fromEntries(models.map(model => [model.name ?? model.table, model])),
    )

    const plan = qb.buildMigrationPlan(defined, {})
    const drift = await qb.auditSchemaDrift(plan, {})

    return { ...drift, skipped: false }
  }
  catch {
    return empty
  }
}

/** Re-exported so callers format one way. */
export async function formatSchemaDrift(report: SchemaDriftReport): Promise<string> {
  if (report.skipped || report.clean)
    return ''

  const { formatSchemaDrift: format } = await import('bun-query-builder') as unknown as {
    formatSchemaDrift?: (report: unknown) => string
  }

  return typeof format === 'function' ? format(report) : ''
}
