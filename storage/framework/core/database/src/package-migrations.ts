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
export function isPackageMigration(file: string): boolean {
  const ordinal = /^(\d+)-/.exec(file)?.[1]
  return ordinal !== undefined && Number.parseInt(ordinal, 10) >= PACKAGE_MIGRATION_BAND
}
