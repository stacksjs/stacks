/**
 * Shared types for the `./buddy migrate:project` migrators (Laravel,
 * Rails, …). Each driver consumes a source-project root and emits
 * Stacks-shaped files under a target root, returning a structured
 * report so the CLI can show the user what landed and what got
 * skipped.
 *
 * The migration is intentionally best-effort. The drivers prioritise
 * the high-value 80% (schema → migrations, models, env) and surface
 * unrecognised constructs as `skipped` entries rather than throwing —
 * a partial port the user can clean up beats a full failure mid-run.
 *
 * stacksjs/stacks#1241.
 */

export type SourceFramework = 'laravel' | 'rails'

export interface MigrateProjectRequest {
  /** Absolute path to the existing source project (Laravel app, Rails app, …). */
  source: string
  /** Absolute path of the freshly-scaffolded Stacks project to receive emitted files. */
  target: string
  /** Which driver to use. CLI may auto-detect later, but the explicit form is required today. */
  from: SourceFramework
  /** When true, run discovery + plan without writing anything. */
  dryRun?: boolean
}

/**
 * A single output produced (or attempted) by a driver. Drivers append
 * one `ReportEntry` per source file they touch so the report reads
 * like a checklist of what was translated.
 */
export interface ReportEntry {
  /** Path of the source artifact, relative to the source project root. */
  source: string
  /** Path of the emitted target artifact, relative to the target project root. Empty for skipped entries. */
  target: string
  /**
   * - `translated` — emitted a Stacks-shaped file from the source.
   * - `copied`     — written verbatim (env files, fixtures).
   * - `skipped`    — recognised but unsupported (Rails driver, Blade templates, etc.).
   * - `failed`     — recognised and attempted but parsing blew up (notes contain the error).
   */
  status: 'translated' | 'copied' | 'skipped' | 'failed'
  /** Human-readable detail — what got translated, why something was skipped, etc. */
  note?: string
}

export interface MigrationReport {
  source: string
  target: string
  from: SourceFramework
  startedAt: string
  finishedAt: string
  entries: ReportEntry[]
}

export interface Driver {
  readonly name: SourceFramework
  /**
   * Drivers must be pure with respect to the filesystem: read from
   * `req.source`, write under `req.target`, never mutate elsewhere.
   * Return a list of `ReportEntry` rows — the orchestrator wraps them
   * in a `MigrationReport`.
   */
  migrate: (req: MigrateProjectRequest) => Promise<ReportEntry[]>
}
