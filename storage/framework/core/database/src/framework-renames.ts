/**
 * Framework model renames, carried into databases and snapshots that predate
 * them.
 *
 * When the framework renames one of its own default models, every app that
 * upgrades across the rename is left holding two stale things:
 *
 * 1. A live database with the old tables and columns in it.
 * 2. `storage/framework/database/model-snapshot.<dialect>.json`, the baseline
 *    `buddy migrate` diffs the models against (it never diffs the database).
 *
 * The second is the one that stops a deploy. The differ finds tables no model
 * declares, proposes dropping them, and - correctly - refuses to do that
 * unattended. It proposes the same drop on a fresh database too, because the
 * snapshot says nothing about the database at all. So every CI run and every
 * deploy `preStart` fails until somebody intervenes by hand, in every app.
 *
 * Each rename is recorded here once, and `buddy migrate` applies it before it
 * diffs: to the snapshot, so the differ sees the schema it already had under
 * its new names, and to the database, renaming rather than dropping so rows
 * survive.
 *
 * The database side follows the rules the one-off shell script that preceded
 * this (stacksjs/stacks#2382) was rehearsed against production with:
 *
 * - Guard every step on what the schema actually holds, so it is a no-op on a
 *   database that never had the old names and on one already caught up.
 * - When both the old and the new table exist, the one holding rows wins the
 *   name; when both hold rows, refuse. Only a human can say which is real.
 * - On SQLite, rename with `foreign_keys = ON`. SQLite rewrites the REFERENCES
 *   clauses in *other* tables during a rename only while foreign keys are
 *   enabled; with them off the rename succeeds and leaves `courier_pings`
 *   pointing at a `drivers` table that no longer exists, which nothing notices
 *   until the first insert under enforced keys.
 *
 * MySQL and Postgres get the unambiguous cases (old present, new absent) and
 * skip the rest with a message: both keep foreign keys attached through a
 * rename, but clearing an empty table out of the way needs a drop that other
 * tables' constraints can block, and that is not a thing to guess at.
 */

import type { MigrationPlan } from '@stacksjs/query-builder'

export interface FrameworkTableRename {
  from: string
  to: string
}

export interface FrameworkColumnRename {
  /** The table's name AFTER any table rename in the same group. */
  table: string
  from: string
  to: string
}

export interface FrameworkRename {
  /** Stable identifier, used in log lines. */
  id: string
  /** Where the rename was made, for whoever reads the log. */
  reference: string
  tables: readonly FrameworkTableRename[]
  columns: readonly FrameworkColumnRename[]
}

/**
 * Every rename the framework has made to a default model's schema.
 *
 * Append-only. An entry costs a handful of catalog reads per migrate and is a
 * no-op everywhere it has already applied, so there is no point at which it
 * becomes safe to delete one: an app can upgrade across it at any time.
 */
export const FRAMEWORK_RENAMES: readonly FrameworkRename[] = [
  {
    // b2c4665958: "driver" already meant a database or provider adapter
    // everywhere else, so the delivery person became a courier.
    id: 'driver-to-courier',
    reference: 'stacksjs/stacks#2382',
    tables: [
      { from: 'drivers', to: 'couriers' },
      { from: 'driver_pings', to: 'courier_pings' },
    ],
    columns: [
      { table: 'courier_pings', from: 'driver_id', to: 'courier_id' },
      { table: 'delivery_routes', from: 'driver', to: 'courier' },
      { table: 'delivery_routes', from: 'driver_id', to: 'courier_id' },
    ],
  },
]

/**
 * The renames that may be applied, given the tables the app's models declare.
 *
 * A group is skipped when anything still declares one of its OLD tables. An app
 * with its own `Driver` model over `drivers` - a racing app, say - owns that
 * table, and renaming it to `couriers` because the framework once had a model
 * of that name would be exactly the kind of silent damage this module exists
 * to prevent.
 */
export function applicableFrameworkRenames(
  declaredTables: ReadonlySet<string>,
  renames: readonly FrameworkRename[] = FRAMEWORK_RENAMES,
): FrameworkRename[] {
  const declared = new Set([...declaredTables].map(table => table.toLowerCase()))
  return renames.filter(group => !group.tables.some(rename => declared.has(rename.from.toLowerCase())))
}

/**
 * Replace a table name where it appears as a whole `_`-delimited part of an
 * identifier, so `drivers_uuid_unique` becomes `couriers_uuid_unique` and
 * `drivers_drivers_uuid_unique` loses both, while `subdrivers_x` is left alone.
 */
export function renameIdentifierPart(identifier: string, from: string, to: string): string {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return identifier.replace(new RegExp(`(^|_)${escaped}(?=_|$)`, 'g'), (_match, lead: string) => `${lead}${to}`)
}

export interface PlanRenameResult {
  plan: MigrationPlan
  /** One line per change made, empty when the plan was already current. */
  changes: string[]
}

/**
 * Rewrite a stored model snapshot so it describes the same schema under the
 * renamed names. Pure: returns a new plan and never touches the input.
 *
 * What moves: the table entry, index names derived from the table name,
 * other tables' foreign-key `references`, and the renamed columns (including
 * where an index lists them).
 *
 * When the snapshot somehow already holds BOTH names, the old entry is
 * removed rather than merged: the new one is what the models describe, and a
 * leftover old entry is only ever read back as a table to drop.
 */
export function applyFrameworkRenamesToPlan(
  plan: MigrationPlan,
  renames: readonly FrameworkRename[] = FRAMEWORK_RENAMES,
): PlanRenameResult {
  const next: MigrationPlan = structuredClone(plan)
  const changes: string[] = []

  for (const group of renames) {
    for (const { from, to } of group.tables) {
      const oldIndex = next.tables.findIndex(table => table.table === from)
      if (oldIndex !== -1) {
        if (next.tables.some(table => table.table === to)) {
          next.tables.splice(oldIndex, 1)
          changes.push(`removed stale ${from} (the snapshot already describes ${to})`)
        }
        else {
          const entry = next.tables[oldIndex]!
          entry.table = to
          for (const index of entry.indexes ?? [])
            index.name = renameIdentifierPart(index.name, from, to)
          changes.push(`${from} -> ${to}`)
        }
      }

      for (const table of next.tables) {
        for (const column of table.columns) {
          if (column.references?.table === from) {
            column.references.table = to
            changes.push(`${table.table}.${column.name} references ${to}`)
          }
        }
      }
    }

    for (const { table: tableName, from, to } of group.columns) {
      const table = next.tables.find(entry => entry.table === tableName)
      if (!table)
        continue
      const oldIndex = table.columns.findIndex(column => column.name === from)
      if (oldIndex === -1)
        continue

      if (table.columns.some(column => column.name === to)) {
        table.columns.splice(oldIndex, 1)
        changes.push(`removed stale ${tableName}.${from} (the snapshot already describes ${to})`)
      }
      else {
        table.columns[oldIndex]!.name = to
        changes.push(`${tableName}.${from} -> ${to}`)
      }

      for (const index of table.indexes ?? [])
        index.columns = index.columns.map(column => column === from ? to : column)
    }
  }

  return { plan: next, changes }
}

/** Runs one SQL string and returns its rows (empty for statements with none). */
export type RenameSqlRunner = (sql: string) => Promise<any[]>

export type RenameDialect = 'sqlite' | 'mysql' | 'postgres'

export interface DatabaseRenameResult {
  /** Changes made, one line each. Empty on a database already caught up. */
  applied: string[]
  /** Cases left alone, with why, for the operator. */
  skipped: string[]
}

/** Thrown when both the old and the new table hold rows. Nothing is changed. */
export class FrameworkRenameConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FrameworkRenameConflictError'
  }
}

function quote(dialect: RenameDialect, identifier: string): string {
  return dialect === 'mysql'
    ? `\`${identifier.replace(/`/g, '``')}\``
    : `"${identifier.replace(/"/g, '""')}"`
}

function firstValue(row: unknown): unknown {
  if (!row || typeof row !== 'object')
    return undefined
  return Object.values(row as Record<string, unknown>)[0]
}

function pickString(row: any, ...keys: string[]): string {
  for (const key of keys) {
    const value = row?.[key] ?? row?.[key.toLowerCase()] ?? row?.[key.toUpperCase()]
    if (typeof value === 'string')
      return value
  }
  return ''
}

/** Catalog reads, per dialect. Kept to plain SELECTs so any runner can serve them. */
function catalog(dialect: RenameDialect, run: RenameSqlRunner) {
  const literal = (value: string): string => `'${value.replace(/'/g, '\'\'')}'`

  async function count(sql: string): Promise<number> {
    const rows = await run(sql)
    return Number(firstValue(rows[0]) ?? 0)
  }

  return {
    async tableExists(table: string): Promise<boolean> {
      if (dialect === 'sqlite')
        return await count(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = ${literal(table)}`) > 0
      if (dialect === 'mysql')
        return await count(`SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${literal(table)}`) > 0
      return await count(`SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = ${literal(table)}`) > 0
    },

    async columnExists(table: string, column: string): Promise<boolean> {
      if (dialect === 'sqlite')
        return await count(`SELECT COUNT(*) AS n FROM pragma_table_info(${literal(table)}) WHERE name = ${literal(column)}`) > 0
      if (dialect === 'mysql')
        return await count(`SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${literal(table)} AND COLUMN_NAME = ${literal(column)}`) > 0
      return await count(`SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ${literal(table)} AND column_name = ${literal(column)}`) > 0
    },

    async rowCount(table: string): Promise<number> {
      return count(`SELECT COUNT(*) AS n FROM ${quote(dialect, table)}`)
    },

    /** SQLite only: indexes on `table` with their CREATE statements. */
    async sqliteIndexes(table: string): Promise<Array<{ name: string, sql: string }>> {
      const rows = await run(`SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ${literal(table)} AND sql IS NOT NULL`)
      return rows.map(row => ({ name: pickString(row, 'name'), sql: pickString(row, 'sql') })).filter(index => index.name && index.sql)
    },
  }
}

/**
 * Bring a live database up to the renamed schema. Idempotent: a second run on
 * the same database applies nothing.
 *
 * Throws {@link FrameworkRenameConflictError} before changing anything in a
 * group whose old and new tables both hold rows.
 */
export async function applyFrameworkRenamesToDatabase(
  run: RenameSqlRunner,
  dialect: RenameDialect,
  renames: readonly FrameworkRename[] = FRAMEWORK_RENAMES,
): Promise<DatabaseRenameResult> {
  const result: DatabaseRenameResult = { applied: [], skipped: [] }
  const db = catalog(dialect, run)
  const q = (identifier: string): string => quote(dialect, identifier)

  let foreignKeysChecked = false
  const ensureSqliteForeignKeys = async (): Promise<void> => {
    if (dialect !== 'sqlite' || foreignKeysChecked)
      return
    // Load-bearing, see the module comment: without it SQLite leaves other
    // tables' REFERENCES naming the old table. Verified rather than assumed,
    // because the pragma is a silent no-op inside a transaction.
    await run('PRAGMA foreign_keys = ON')
    const enabled = Number(firstValue((await run('PRAGMA foreign_keys'))[0]) ?? 0)
    if (enabled !== 1) {
      throw new Error(
        'Cannot apply framework table renames: SQLite foreign keys could not be enabled on this connection, '
        + 'and renaming with them off leaves other tables referencing the old table name.',
      )
    }
    foreignKeysChecked = true
  }

  for (const group of renames) {
    // Decide every table in the group before touching any of them, so a
    // conflict on the second table cannot leave the first half-renamed.
    const plans: Array<{ from: string, to: string, action: 'rename' | 'replace-empty-new' | 'drop-empty-old' | 'skip', reason?: string }> = []

    for (const { from, to } of group.tables) {
      if (!(await db.tableExists(from))) {
        plans.push({ from, to, action: 'skip' })
        continue
      }
      if (!(await db.tableExists(to))) {
        plans.push({ from, to, action: 'rename' })
        continue
      }

      const oldRows = await db.rowCount(from)
      const newRows = await db.rowCount(to)
      if (oldRows > 0 && newRows > 0) {
        throw new FrameworkRenameConflictError(
          `${from} (${oldRows} row${oldRows === 1 ? '' : 's'}) and ${to} (${newRows} row${newRows === 1 ? '' : 's'}) both hold data, `
          + `so the ${group.id} rename (${group.reference}) cannot tell which is real. Merge them by hand, `
          + `leaving the rows in ${to} and ${from} empty or dropped, then run migrate again.`,
        )
      }

      if (dialect !== 'sqlite') {
        plans.push({
          from,
          to,
          action: 'skip',
          reason: `${from} and ${to} both exist; ${newRows > 0 ? `drop the empty ${from}` : `drop the empty ${to} and rename ${from} to ${to}`} by hand (${group.reference})`,
        })
        continue
      }

      plans.push({ from, to, action: newRows > 0 ? 'drop-empty-old' : 'replace-empty-new' })
    }

    for (const plan of plans) {
      if (plan.action === 'skip') {
        if (plan.reason)
          result.skipped.push(plan.reason)
        continue
      }

      await ensureSqliteForeignKeys()

      if (plan.action === 'drop-empty-old') {
        await run(`DROP TABLE ${q(plan.from)}`)
        result.applied.push(`dropped empty legacy ${plan.from} (${plan.to} holds the rows)`)
        continue
      }

      if (plan.action === 'replace-empty-new') {
        // The new table is an empty shell something created from the new
        // schema. Clear the name for the table that has the history.
        await run(`DROP TABLE ${q(plan.to)}`)
        result.applied.push(`dropped empty ${plan.to} to make way for ${plan.from}`)
      }

      await run(`ALTER TABLE ${q(plan.from)} RENAME TO ${q(plan.to)}`)
      result.applied.push(`renamed ${plan.from} -> ${plan.to}`)
    }

    // Index names carry the table name, and a rename does not touch them. Done
    // whenever the new table exists rather than only straight after a rename,
    // so a database renamed by an earlier tool still catches up.
    if (dialect === 'sqlite') {
      for (const { from, to } of group.tables) {
        if (!(await db.tableExists(to)))
          continue
        for (const index of await db.sqliteIndexes(to)) {
          const renamed = renameIdentifierPart(index.name, from, to)
          if (renamed === index.name)
            continue
          if ((await db.sqliteIndexes(to)).some(existing => existing.name === renamed)) {
            result.skipped.push(`index ${index.name} left as is: ${renamed} already exists`)
            continue
          }
          const createSql = replaceIndexName(index.sql, index.name, renamed)
          if (!createSql) {
            result.skipped.push(`index ${index.name} left as is: could not read its definition`)
            continue
          }
          await ensureSqliteForeignKeys()
          await run(createSql)
          await run(`DROP INDEX ${q(index.name)}`)
          result.applied.push(`renamed index ${index.name} -> ${renamed}`)
        }
      }
    }

    for (const { table, from, to } of group.columns) {
      if (!(await db.tableExists(table)) || !(await db.columnExists(table, from)))
        continue
      if (await db.columnExists(table, to)) {
        result.skipped.push(`${table} has both ${from} and ${to}; ${from} is left in place, move its values by hand if it holds any (${group.reference})`)
        continue
      }
      await ensureSqliteForeignKeys()
      await run(`ALTER TABLE ${q(table)} RENAME COLUMN ${q(from)} TO ${q(to)}`)
      result.applied.push(`renamed ${table}.${from} -> ${to}`)
    }
  }

  return result
}

/**
 * Swap the index name in a stored `CREATE [UNIQUE] INDEX` statement. Returns
 * undefined when the statement does not have the expected shape, so the caller
 * leaves that index alone rather than guessing.
 */
export function replaceIndexName(createSql: string, from: string, to: string): string | undefined {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`^(\\s*CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?)(["\`\\[]?)${escaped}(["\`\\]]?)(\\s)`, 'i')
  if (!pattern.test(createSql))
    return undefined
  return createSql.replace(pattern, (_match, head: string, open: string, close: string, space: string) => `${head}${open}${to}${close}${space}`)
}
