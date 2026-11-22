/**
 * Generate what is safe, hold back what destroys data.
 *
 * A model diff often mixes two very different kinds of change. Adding a
 * column or a table loses nothing. Dropping a table or a column that no model
 * describes any more deletes whatever is in it. `buddy migrate` asks before
 * the second kind, and used to treat a "no" (or a run with nobody to ask) as
 * a reason to do nothing at all, so one leftover table blocked every later
 * migration until someone agreed to delete it.
 *
 * These two functions split the diff instead. The safe part is generated and
 * applied. The destructive part is left out of the SQL and kept in the
 * snapshot, so the next run proposes it again and nothing is forgotten.
 */
import type { MigrationOperation, MigrationPlan } from '@stacksjs/query-builder'

const DROP_TABLE = /^\s*DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?[`"[]?([\w.]+)[`"\]]?/i
const DROP_COLUMN = /^\s*ALTER\s+TABLE\s+[`"[]?([\w.]+)[`"\]]?\s+DROP\s+(?:COLUMN\s+)?(?:IF\s+EXISTS\s+)?[`"[]?(\w+)[`"\]]?/i

function normalize(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().replace(/;$/, '')
}

function lower(value: string | undefined): string {
  return String(value ?? '').toLowerCase()
}

export interface HeldBackChanges {
  /** The generated SQL without the destructive statements. */
  statements: string[]
  /** The operations that were left out, for reporting and for the snapshot. */
  held: MigrationOperation[]
}

/**
 * Remove destructive operations from generated SQL.
 *
 * On SQLite a table rebuild recreates the table from the model, so a rebuild
 * of a table that also has a held-back column drop would drop that column
 * after all. Such a rebuild is held back with it: the whole table waits.
 */
export function holdBackDestructiveChanges(
  statements: readonly string[],
  operations: readonly MigrationOperation[],
): HeldBackChanges {
  const destructive = operations.filter(operation => operation.destructive)
  if (destructive.length === 0)
    return { statements: [...statements], held: [] }

  const tablesWithHeldColumns = new Set(
    destructive.filter(operation => operation.kind === 'drop_column').map(operation => lower(operation.table)),
  )
  const rebuilds = operations.filter(
    operation => operation.kind === 'rebuild_table' && !operation.destructive && tablesWithHeldColumns.has(lower(operation.table)),
  )
  const held = [...destructive, ...rebuilds]

  const heldSql = new Set(held.filter(operation => Boolean(operation.sql)).map(operation => normalize(operation.sql)))
  const heldTables = new Set(held.filter(operation => operation.kind === 'drop_table').map(operation => lower(operation.table)))
  const heldColumns = new Set(
    held.filter(operation => operation.kind === 'drop_column').map(operation => `${lower(operation.table)}.${lower(operation.column)}`),
  )

  const kept = statements.filter((statement) => {
    if (heldSql.has(normalize(statement)))
      return false
    // A dialect may not emit the operation's `sql` byte for byte (Postgres
    // appends CASCADE, MySQL quotes with backticks), so match the shape too.
    const table = statement.match(DROP_TABLE)
    if (table?.[1] && heldTables.has(lower(table[1])))
      return false
    const column = statement.match(DROP_COLUMN)
    if (column?.[1] && column[2] && heldColumns.has(`${lower(column[1])}.${lower(column[2])}`))
      return false
    return true
  })

  return { statements: kept, held }
}

/**
 * The snapshot to store when changes were held back.
 *
 * The snapshot is what the next diff starts from. If it simply became the
 * models' plan, a held-back table would no longer be in it, the next diff
 * would see nothing to drop, and the table would stay forever without anyone
 * being told again. So whatever was held back is carried over from the
 * previous snapshot: the table for a held drop or rebuild, the column for a
 * held column drop.
 *
 * With no previous snapshot there is nothing to carry over and the plan is
 * returned as it is; `buddy migrate --from-db` finds such leftovers again.
 */
export function planKeepingHeldBackChanges(
  plan: MigrationPlan,
  previous: MigrationPlan | undefined,
  held: readonly MigrationOperation[],
): MigrationPlan {
  if (!previous || held.length === 0)
    return plan

  const before = new Map(previous.tables.map(table => [lower(table.table), table]))
  const tables = plan.tables.map(table => ({ ...table, columns: [...table.columns] }))
  const index = new Map(tables.map((table, position) => [lower(table.table), position]))

  for (const operation of held) {
    const name = lower(operation.table)
    const old = before.get(name)
    if (!old)
      continue

    if (operation.kind === 'drop_table') {
      if (!index.has(name)) {
        index.set(name, tables.length)
        tables.push(old)
      }
      continue
    }

    if (operation.kind === 'rebuild_table') {
      // The table is as the previous snapshot describes it until the rebuild runs.
      const position = index.get(name)
      if (position === undefined) {
        index.set(name, tables.length)
        tables.push(old)
      }
      else {
        tables[position] = old
      }
      continue
    }

    if (operation.kind === 'drop_column') {
      const position = index.get(name)
      if (position === undefined)
        continue
      const table = tables[position]!
      const column = old.columns.find(candidate => lower(candidate.name) === lower(operation.column))
      if (column && !table.columns.some(candidate => lower(candidate.name) === lower(column.name)))
        table.columns.push(column)
    }
  }

  return { ...plan, tables }
}

/** One line per held-back change, for the message `buddy migrate` prints. */
export function describeHeldBackChange(operation: MigrationOperation): string {
  if (operation.kind === 'drop_table')
    return `table "${operation.table}" (not dropped; its rows are untouched)`
  if (operation.kind === 'drop_column')
    return `column "${operation.table}"."${operation.column}" (not dropped; its data is untouched)`
  if (operation.kind === 'rebuild_table')
    return `table "${operation.table}" (not rebuilt, because rebuilding it would drop a held-back column)`
  return `${operation.kind} on "${operation.table}"`
}
