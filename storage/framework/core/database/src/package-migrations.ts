import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The ordinal band reserved for migrations a discovered package brings.
 *
 * Migrations run in the order `readdirSync(dir).sort()` returns, so the leading
 * ordinal in a filename IS the run order. A package's tables carry foreign keys
 * into the application's (`user_id`, `team_id`) and never the reverse, because
 * the application predates whatever it installed. A `REFERENCES "users"` on a
 * table created before `users` fails on Postgres and MySQL while SQLite
 * tolerates it, so getting this order wrong is green locally and red on deploy.
 *
 * A reserved high band rather than `max + 1`, because three separate ordinal
 * computations would otherwise invert the order: `migrate:regenerate`
 * renumbers the application corpus from 1 while preserving unmarked files,
 * `historicalBoundary` takes the maximum ordinal among unmarked files, and
 * `nextMigrationNumber` maxes over every file on disk. Each of them would
 * either number an application migration above a package's or drag the whole
 * application corpus up into the band.
 *
 * Still ten digits, so lexicographic order and numeric order agree.
 */
export const PACKAGE_MIGRATION_BAND = 9_000_000_000

/**
 * Whether a migration filename belongs to a discovered package.
 *
 * Read from the ordinal rather than from the file's contents: every guard that
 * needs this answer is deciding whether to renumber or delete the file, and
 * those run in loops over a directory listing where opening each file would be
 * the expensive part.
 */
export const PACKAGE_MIGRATION_BAND_END = 9_999_999_999

export function isPackageMigration(file: string): boolean {
  const ordinal = /^(\d+)-/.exec(file)?.[1]
  if (ordinal === undefined)
    return false

  const value = Number.parseInt(ordinal, 10)
  // Bounded, not open-ended. `buddy make:migration` names its files
  // `${Date.now()}-…`, which is thirteen digits and therefore ABOVE an
  // open-ended `>= PACKAGE_MIGRATION_BAND` - so every hand-made migration read
  // as a package's. `nextMigrationNumber` then skipped all fifty of them and
  // handed the next generated migration ordinal 172, which sorts before every
  // one: `0000000172-alter-pledges-columns.sql` ran before
  // `1785502251845-create-pledges-table.sql` created the table, and
  // `buddy migrate:fresh` died on "no such table: pledges".
  //
  // Ten digits is what the band was always documented as.
  return value >= PACKAGE_MIGRATION_BAND && value <= PACKAGE_MIGRATION_BAND_END
}

/** One package migration copied into the corpus the runner executes. */
export interface StagedPackageMigration {
  /** The package that ships it. */
  package: string
  /** Absolute path inside the installed package. */
  source: string
  /** Basename it is staged under, which is what the ledger records. */
  name: string
}

/**
 * The name a package's migration is staged under.
 *
 * Every package migration shares the SAME band ordinal, and the package name
 * and the file's original name break the tie. That is what makes the staged
 * name stable: an ordinal handed out by position would renumber every file
 * after the one that moved the moment another package was installed or
 * removed, and the ledger keys on the bare basename, so those files would read
 * as new and run a second time against tables they had already created.
 *
 * Sorting still lands where it has to, because the runner orders on the whole
 * filename and only reaches the tie-break once the ordinals are equal:
 *
 *   0000000133-add-orthomosaic.sql          <- the application, always first
 *   9000000000-bughq__0000000001-issues.sql <- then by package name
 *   9000000000-loghq__0000000001-create.sql <- then by the package's own order
 *   9000000000-loghq__0000000002-alter.sql
 *
 * The package's original ordinal is kept rather than stripped. A package
 * declares its own internal order the same way the application does, and
 * `create-…` before `alter-…` is not something alphabetical order preserves.
 */
export function stagedMigrationName(packageName: string, originalFile: string): string {
  // `__` because a single `-` is already the ordinal separator, and package
  // names contain `-` far more often than they contain `__`.
  return `${PACKAGE_MIGRATION_BAND}-${packageName.replace(/[/\\]/g, '+')}__${originalFile}`
}

/**
 * Copy each discovered package's migrations into the corpus that will run.
 *
 * Staged rather than run in place because the runner treats the corpus as
 * writable: SQLite preprocessing deletes duplicate CREATEs and drops
 * statements the dialect cannot execute, and both call `unlinkSync` on the
 * file. Pointing that at `node_modules` would have the framework deleting an
 * installed package's files, which the next install silently restores and the
 * one after that deletes again.
 *
 * Returns what it staged, so the caller can report it. A package with no
 * migrations directory contributes nothing and is not an error.
 */
export function stagePackageMigrations(options: {
  roots: { package: string, dir: string }[]
  corpusDir: string
}): StagedPackageMigration[] {
  const staged: StagedPackageMigration[] = []

  for (const root of options.roots) {
    let files: string[]
    try {
      files = readdirSync(root.dir).filter(f => f.endsWith('.sql')).sort()
    }
    catch {
      continue // declared but absent, which `packageMigrationRoots` already filters
    }

    for (const file of files) {
      const name = stagedMigrationName(root.package, file)
      const source = join(root.dir, file)
      const target = join(options.corpusDir, name)

      // Overwrite only on a real difference. Rewriting an identical file would
      // move its mtime on every migrate run for no reason, and the corpus is a
      // directory other things watch.
      let incoming: string
      try {
        incoming = readFileSync(source, 'utf8')
      }
      catch {
        continue // unreadable file in the package: not the application's problem
      }

      let current: string | undefined
      try {
        current = readFileSync(target, 'utf8')
      }
      catch {
        current = undefined
      }

      // A changed file is republished so that a fresh database builds the
      // schema the installed version describes. It does NOT re-run on a
      // database that already has it: the ledger keys on this basename, which
      // is exactly why the name is stable. A package that needs to change an
      // applied table ships another migration, the same as an application.
      if (current !== incoming)
        writeFileSync(target, incoming)

      staged.push({ package: root.package, source, name })
    }
  }

  return staged
}
