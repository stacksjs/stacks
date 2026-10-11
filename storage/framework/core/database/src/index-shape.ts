// Kept in its own module, free of configuration, so the ledger audit and the
// schema aligner can compare indexes without evaluating `migrations.ts`, which
// captures the database settings at import time.

/**
 * What a `CREATE INDEX` builds, apart from what it calls it.
 *
 * `key` is the table, whether the index is unique, its column list (with any
 * sort order) and its `WHERE` clause, normalized - everything that decides what
 * the index does, and nothing that only names it. Two statements with the same
 * key build the same index.
 */
export interface IndexShape {
  name: string
  table: string
  key: string
}

const unquoteIdentifiers = (sql: string): string => sql.replace(/["'`[\]]/g, '')
const collapseWhitespace = (sql: string): string => sql.replace(/\s+/g, ' ').trim()

export function indexShape(statement: string): IndexShape | undefined {
  const head = /^\s*CREATE\s+(UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?["'`[]?([\w$]+)["'`\]]?\s+ON\s+["'`[]?([\w$]+)["'`\]]?\s*\(/i.exec(statement)
  if (!head?.[2] || !head[3])
    return undefined

  // The column list ends at the bracket that closes the one `head` opened, not
  // at the first `)`: an expression column like `lower(email)` has its own.
  let depth = 1
  let end = head[0].length
  for (; end < statement.length && depth > 0; end++) {
    if (statement[end] === '(')
      depth++
    else if (statement[end] === ')')
      depth--
  }
  if (depth > 0)
    return undefined

  const columns = statement.slice(head[0].length, end - 1).split(',')
    .map(column => collapseWhitespace(unquoteIdentifiers(column)).toLowerCase().replace(/\s+asc$/, ''))
  const where = collapseWhitespace(unquoteIdentifiers(statement.slice(end)).replace(/;\s*$/, '')).toLowerCase()
  const table = head[3].toLowerCase()

  return {
    name: head[2].toLowerCase(),
    table,
    key: `${head[1] ? 'unique' : 'index'} ${table} (${columns.join(', ')})${where ? ` ${where}` : ''}`,
  }
}

/**
 * A Postgres catalog index definition rewritten into the shape a migration
 * writes, so {@link indexShape} reads both the same way.
 *
 * `pg_get_indexdef` / `pg_indexes.indexdef` qualify the table with its schema
 * and name the access method: `CREATE UNIQUE INDEX x ON public.users USING
 * btree (email)`. A migration says neither, so both come off. Only the default
 * `btree` method is dropped; any other method stays in the key, because a GIN
 * index and a btree index over the same column are not the same index.
 */
export function postgresIndexStatement(definition: string): string {
  return definition
    .replace(/\bON\s+ONLY\s+/i, 'ON ')
    .replace(/\bON\s+(?:"[^"]+"|\w+)\.("?[\w$]+"?)/i, 'ON $1')
    .replace(/\s+USING\s+btree\s*\(/i, ' (')
}

/**
 * An index key two different spellings of the same index agree on.
 *
 * Stricter than nothing and looser than {@link indexShape}'s `key`: the
 * catalog hands back what the server parsed, not what was written, so a
 * predicate written `WHERE deleted_at IS NULL` comes back as
 * `WHERE (deleted_at IS NULL)` and `status = 'active'` as
 * `((status)::text = 'active'::text)`. Casts and brackets are dropped on both
 * sides; names, operators and literals are kept, so two indexes that differ in
 * anything that changes which rows they cover still differ here.
 */
export function comparableIndexKey(statement: string): string | undefined {
  const shape = indexShape(statement)
  if (!shape)
    return undefined
  return collapseWhitespace(
    shape.key
      .replace(/::\s*(?:"[^"]+"|[a-z_]\w*)(?:\s+varying|\s+precision|\s+with(?:out)?\s+time\s+zone)?(?:\[\])?/gi, '')
      .replace(/[()]/g, ' ')
      .replace(/\s*,\s*/g, ', '),
  )
}
