/**
 * Laravel → Stacks migrator orchestrator (stacksjs/stacks#1241).
 *
 * Walks a Laravel project root and translates the three highest-value
 * surfaces:
 *
 *   - `database/migrations/*.php`   → `database/migrations/*.sql`
 *   - `app/Models/*.php`            → `app/Models/*.ts`
 *   - `.env` / `.env.example`       → copied verbatim (Stacks reads
 *                                     compatible keys; the user is
 *                                     responsible for renaming
 *                                     anything Laravel-specific).
 *
 * Routes, controllers, blade views, seeders, queue jobs, and
 * composer.json dependency mapping are deliberately out of scope for
 * this MVP — each surfaces as a `skipped` entry in the migration
 * report so the user knows what they need to hand-port.
 */

import type { Driver, MigrateProjectRequest, ReportEntry } from '../types'
import { existsSync, readdirSync } from 'node:fs'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { laravelFilenameToStacks, parseLaravelMigration } from './migrations'
import { parseLaravelModel } from './models'

export const laravelDriver: Driver = {
  name: 'laravel',
  async migrate(req: MigrateProjectRequest): Promise<ReportEntry[]> {
    const entries: ReportEntry[] = []
    entries.push(...await migrateEnv(req))
    entries.push(...await migrateMigrations(req))
    entries.push(...await migrateModels(req))
    entries.push(...summariseDeferred(req))
    return entries
  },
}

async function migrateEnv(req: MigrateProjectRequest): Promise<ReportEntry[]> {
  const out: ReportEntry[] = []
  for (const file of ['.env', '.env.example']) {
    const sourcePath = join(req.source, file)
    if (!existsSync(sourcePath)) continue
    const targetPath = join(req.target, file)
    if (!req.dryRun) {
      await mkdir(req.target, { recursive: true })
      await copyFile(sourcePath, targetPath)
    }
    out.push({
      source: file,
      target: file,
      status: 'copied',
      note: 'Laravel-specific keys (BROADCAST_DRIVER, FILESYSTEM_DISK names) may need renaming; Stacks reads APP_*/DB_*/MAIL_* keys as-is.',
    })
  }
  return out
}

async function migrateMigrations(req: MigrateProjectRequest): Promise<ReportEntry[]> {
  const dir = join(req.source, 'database', 'migrations')
  if (!existsSync(dir)) return []

  const files = readdirSync(dir)
    .filter(f => f.endsWith('.php'))
    .sort() // Laravel filenames are timestamp-prefixed, so lexicographic == chronological.

  const targetDir = join(req.target, 'database', 'migrations')
  if (!req.dryRun) await mkdir(targetDir, { recursive: true })

  const out: ReportEntry[] = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]!
    const rel = `database/migrations/${file}`
    try {
      const body = await readFile(join(dir, file), 'utf8')
      const parsed = parseLaravelMigration(body)
      if (!parsed) {
        out.push({
          source: rel,
          target: '',
          status: 'skipped',
          note: 'No `Schema::create(...)` block found (likely an alter / drop / data-only migration).',
        })
        continue
      }

      const sequence = i + 1
      const outName = laravelFilenameToStacks(file, sequence, parsed.table)
      const outRel = `database/migrations/${outName}`
      if (!req.dryRun) await writeFile(join(req.target, outRel), parsed.sql)

      const skippedNote = parsed.skipped.length > 0
        ? ` Skipped ${parsed.skipped.length} line(s) inside the create block — hand-port from the source migration.`
        : ''
      out.push({
        source: rel,
        target: outRel,
        status: 'translated',
        note: `CREATE TABLE \`${parsed.table}\` emitted.${skippedNote}`,
      })
    }
    catch (err) {
      out.push({
        source: rel,
        target: '',
        status: 'failed',
        note: `Parse error: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }
  return out
}

async function migrateModels(req: MigrateProjectRequest): Promise<ReportEntry[]> {
  const dir = join(req.source, 'app', 'Models')
  if (!existsSync(dir)) return []

  const files = readdirSync(dir).filter(f => f.endsWith('.php'))
  const targetDir = join(req.target, 'app', 'Models')
  if (!req.dryRun) await mkdir(targetDir, { recursive: true })

  const out: ReportEntry[] = []
  for (const file of files) {
    const rel = `app/Models/${file}`
    try {
      const body = await readFile(join(dir, file), 'utf8')
      const parsed = parseLaravelModel(body)
      if (!parsed) {
        out.push({
          source: rel,
          target: '',
          status: 'skipped',
          note: 'No class declaration found.',
        })
        continue
      }

      const outName = `${parsed.className}.ts`
      const outRel = `app/Models/${outName}`
      if (!req.dryRun) await writeFile(join(req.target, outRel), parsed.tsSource)

      const notes = [
        `Attributes: ${parsed.fillable.length} fillable, ${Object.keys(parsed.casts).length} cast`,
        parsed.relationships.length > 0 ? `Relationships: ${parsed.relationships.map(r => `${r.name}(${r.kind})`).join(', ')}` : null,
        ...parsed.notes,
      ].filter(Boolean).join(' | ')

      out.push({
        source: rel,
        target: outRel,
        status: 'translated',
        note: notes || `Model ${parsed.className} emitted.`,
      })
    }
    catch (err) {
      out.push({
        source: rel,
        target: '',
        status: 'failed',
        note: `Parse error: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }
  return out
}

const DEFERRED_SURFACES = [
  { path: 'routes', note: 'routes/web.php + routes/api.php — port to routes/web.ts + routes/api.ts using the Stacks router DSL.' },
  { path: 'app/Http/Controllers', note: 'Controllers → Stacks Actions in app/Actions/. Each controller method maps to one Action file.' },
  { path: 'resources/views', note: 'Blade templates → stx components in resources/views/.' },
  { path: 'database/seeders', note: 'Seeders → database/seeders/*.ts using Stacks SeederContract.' },
  { path: 'app/Console/Commands', note: 'Artisan commands → app/Commands/*.ts in your Stacks project.' },
  { path: 'app/Jobs', note: 'Queue jobs → app/Jobs/*.ts; pair with config/queue.ts driver settings.' },
  { path: 'composer.json', note: 'Dependency map — Laravel packages don\'t translate 1:1; the Stacks docs cover the closest @stacksjs/* equivalents.' },
]

function summariseDeferred(req: MigrateProjectRequest): ReportEntry[] {
  const out: ReportEntry[] = []
  for (const surface of DEFERRED_SURFACES) {
    const sourcePath = join(req.source, surface.path)
    if (!existsSync(sourcePath)) continue
    out.push({
      source: surface.path,
      target: '',
      status: 'skipped',
      note: surface.note,
    })
  }
  return out
}
