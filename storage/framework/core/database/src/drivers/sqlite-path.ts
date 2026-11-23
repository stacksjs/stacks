import { isAbsolute, join } from 'node:path'

/**
 * The SQLite file a connection uses: the configured path, resolved against
 * the project root when relative, else `fallback`.
 *
 * `fetchSqliteFile()` used to ignore the configured path and always answer
 * `database/stacks.sqlite`, so a test's `refreshDatabase()` dropped the tables
 * of the developer's real database however DB_DATABASE_PATH pointed the
 * connection elsewhere (stacksjs/stacks#3362).
 */
export function sqliteFilePath(configured: string | undefined, root: string, fallback = 'database/stacks.sqlite'): string {
  const file = configured || fallback
  return isAbsolute(file) ? file : join(root, file)
}
