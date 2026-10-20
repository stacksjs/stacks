/**
 * Applying a project's `config/qb.ts` without letting it repoint the database.
 *
 * `config/database.ts` owns the connection. `@stacksjs/database` resolves it -
 * the configured driver, the file or server it names, the pool - and hands it
 * to the query builder before anything here runs, because every module that
 * imports a model imports `@stacksjs/database/runtime` first. `config/qb.ts`
 * is for how the query builder behaves: timestamps, pagination, soft deletes,
 * logging.
 *
 * The route generator used to apply `config/qb.ts` whole, so a `dialect` or
 * `database` left in it from the scaffold replaced the resolved connection.
 * That stayed invisible while the model layer was pinned with
 * `configureOrm({ database })`, which outranks `setConfig()`. Once the ORM
 * stopped opening a database on import and configured it through
 * `setConfig()` instead, the last writer won: an app whose qb.ts still said
 * `database/stacks.sqlite` sent every model query to that file, ignoring
 * `DB_DATABASE_PATH` - in a QA run, the developer's own database. The fallback
 * for a project with no qb.ts did the same from `DB_*` alone, which ignored a
 * path set in `config/database.ts`.
 *
 * So the connection keys are refused here, and said so when they disagree
 * with the connection in force.
 */

import type { QueryBuilderOptions } from '@stacksjs/query-builder'

/** The keys that choose the database, rather than how queries behave. */
export const CONNECTION_KEYS = ['dialect', 'database'] as const

type ConnectionKey = typeof CONNECTION_KEYS[number]

/** What `config/qb.ts` may set: everything except the connection. */
export type QueryBuilderBehaviour = Omit<QueryBuilderOptions, ConnectionKey>

export interface ProjectQueryBuilderConfig {
  /** The settings to hand to `setConfig()`. */
  behaviour: QueryBuilderBehaviour
  /** One line per connection key the file set to something other than what is in force. */
  conflicts: string[]
}

/** The connection the query builder is using now, as `config` reports it. */
export interface ActiveConnection {
  dialect?: string
  database?: { database?: string }
}

/**
 * Split a project's `config/qb.ts` into the behaviour to apply and a report on
 * the connection settings it tried to make.
 *
 * A connection key that matches what is already in force is dropped silently:
 * a qb.ts that restates the connection is redundant, not wrong.
 */
export function splitProjectQueryBuilderConfig(
  project: QueryBuilderOptions | null | undefined,
  active: ActiveConnection,
): ProjectQueryBuilderConfig {
  if (!project || typeof project !== 'object')
    return { behaviour: {}, conflicts: [] }

  const { dialect, database, ...behaviour } = project
  const conflicts: string[] = []

  if (dialect !== undefined && dialect !== active.dialect)
    conflicts.push(`dialect '${String(dialect)}' (config/database.ts resolved '${active.dialect ?? 'nothing'}')`)

  const named = (database as { database?: unknown } | undefined)?.database
  if (named !== undefined && named !== active.database?.database)
    conflicts.push(`database '${String(named)}' (config/database.ts resolved '${active.database?.database ?? 'nothing'}')`)

  return { behaviour, conflicts }
}

/** The warning logged when `config/qb.ts` tried to choose the database. */
export function connectionConflictWarning(conflicts: readonly string[]): string {
  return `[orm] config/qb.ts sets the connection, which belongs to config/database.ts, so it was ignored: ${conflicts.join('; ')}. `
    + 'Remove `dialect` and `database` from config/qb.ts.'
}
