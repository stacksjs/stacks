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
