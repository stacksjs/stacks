/**
 * Parse and normalize a SQL query
 */
export function parseQuery(sql: string): { normalized: string, type: string, tables: string[] } {
  const result = {
    // Default values
    normalized: '',
    type: 'OTHER',
    tables: [] as string[],
  }

  if (!sql)
    return result

  try {
    // Convert query to uppercase for easier parsing
    const upperQuery = sql.trim().toUpperCase()

    // Determine query type
    if (upperQuery.startsWith('SELECT'))
      result.type = 'SELECT'
    else if (upperQuery.startsWith('INSERT'))
      result.type = 'INSERT'
    else if (upperQuery.startsWith('UPDATE'))
      result.type = 'UPDATE'
    else if (upperQuery.startsWith('DELETE'))
      result.type = 'DELETE'

    // Extract affected tables
    result.tables = extractTables(sql, result.type)

    // Normalize query
    result.normalized = normalizeQuery(sql)

    return result
  }
  catch {
    // In case of error, just return the original query
    return {
      normalized: sql,
      type: 'OTHER',
      tables: [],
    }
  }
}

/**
 * Build a regex that matches `<keyword> <identifier>` where the
 * identifier can be: bare (unquoted word/digits/underscores/dots), or
 * quoted by `"..."` (Postgres), `\`...\`` (MySQL), or `[...]`
 * (SQLite/SQL Server). Captures the identifier into the appropriate
 * group; the helper below picks whichever matched.
 *
 * Previously the parser only handled the bare form, so logging
 * mis-attributed any query whose tables used spaces or special chars
 * (e.g. `SELECT * FROM "user data"`) and dropped them silently from
 * the request's table list. stacksjs/stacks#1862 L-37.
 */
function buildIdentifierRegex(keyword: string, flags = 'i'): RegExp {
  return new RegExp(`${keyword}\\s+(?:"([^"]+)"|\`([^\`]+)\`|\\[([^\\]]+)\\]|([\\w.]+))`, flags)
}

function pickMatchedIdentifier(match: RegExpMatchArray | null): string | null {
  if (!match) return null
  // Groups 1-4 correspond to: "...", `...`, [...], bare
  const ident = match[1] ?? match[2] ?? match[3] ?? match[4]
  if (!ident) return null
  // Strip schema/db prefix (`schema.table` → `table`).
  return ident.split('.').pop() ?? null
}

/**
 * Extract table names from a SQL query.
 */
function extractTables(sql: string, type: string): string[] {
  const tables: string[] = []

  try {
    // Lowercasing the SQL would break the case-sensitive contents of a
    // quoted identifier (`"User Data"` becomes `"user data"`). Match
    // against the original SQL with the `i` regex flag instead, so the
    // keyword match is case-insensitive but the captured identifier
    // preserves its original casing.
    switch (type) {
      case 'SELECT': {
        // FROM clause + every JOIN clause.
        const fromMatch = sql.match(buildIdentifierRegex('from'))
        const fromTable = pickMatchedIdentifier(fromMatch)
        if (fromTable) tables.push(fromTable)

        const joinRegex = buildIdentifierRegex('join', 'gi')
        for (const m of sql.matchAll(joinRegex)) {
          const joinTable = pickMatchedIdentifier(m as unknown as RegExpMatchArray)
          if (joinTable) tables.push(joinTable)
        }
        break
      }

      case 'INSERT': {
        const intoMatch = sql.match(buildIdentifierRegex('into'))
        const intoTable = pickMatchedIdentifier(intoMatch)
        if (intoTable) tables.push(intoTable)
        break
      }

      case 'UPDATE': {
        const updateMatch = sql.match(buildIdentifierRegex('update'))
        const updateTable = pickMatchedIdentifier(updateMatch)
        if (updateTable) tables.push(updateTable)
        break
      }

      case 'DELETE': {
        const deleteFromMatch = sql.match(buildIdentifierRegex('from'))
        const deleteTable = pickMatchedIdentifier(deleteFromMatch)
        if (deleteTable) tables.push(deleteTable)
        break
      }
    }
  }
  catch {
    // Just return whatever we've got so far
  }

  // Remove duplicates and return
  return [...new Set(tables)].filter(Boolean)
}

/**
 * Normalize a SQL query by replacing literal values with placeholders
 */
function normalizeQuery(sql: string): string {
  try {
    let normalizedSql = sql

    // Replace numeric literals with ? (but not in column/table names like user_id)
    normalizedSql = normalizedSql.replace(/(?<![a-zA-Z_])\b\d+\b(?![a-zA-Z_])/g, '?')

    // Replace string literals with ?
    normalizedSql = normalizedSql.replace(/'([^']|'')*'/g, '?')
    normalizedSql = normalizedSql.replace(/"([^"]|"")*"/g, '?')

    // Replace boolean literals
    normalizedSql = normalizedSql.replace(/\btrue\b/gi, '?')
    normalizedSql = normalizedSql.replace(/\bfalse\b/gi, '?')

    // Replace NULL with ?
    normalizedSql = normalizedSql.replace(/\bnull\b/gi, '?')

    // Normalize whitespace
    normalizedSql = normalizedSql.replace(/\s+/g, ' ').trim()

    return normalizedSql
  }
  catch {
    // In case of an error, return the original
    return sql
  }
}
