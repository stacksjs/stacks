/**
 * Parse and normalize a SQL query
 */
export function parseQuery(sql: string): { normalized: string; type: string; tables: string[] } {
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
    result.normalized = normalizeQuery(sql, result.type)

    return result
  } catch (error) {
    // In case of error, just return the original query
    return {
      normalized: sql,
      type: 'OTHER',
      tables: [],
    }
  }
}

/**
 * Extract table names from a SQL query
 */
function extractTables(sql: string, type: string): string[] {
  const tables: string[] = []
  const lowerSql = sql.toLowerCase()

  try {
    switch (type) {
      case 'SELECT':
        // Look for FROM and JOIN clauses
        const fromMatch = lowerSql.match(/from\s+([a-z0-9_\.]+)/i)
        if (fromMatch && fromMatch[1])
          tables.push(fromMatch[1].replace(/`/g, '').split('.').pop()!)

        // Find all JOIN statements
        const joinRegex = /join\s+([a-z0-9_\.]+)/gi
        let joinMatch
        while ((joinMatch = joinRegex.exec(lowerSql)) !== null) {
          if (joinMatch[1])
            tables.push(joinMatch[1].replace(/`/g, '').split('.').pop()!)
        }
        break

      case 'INSERT':
        // Look for INTO clause
        const intoMatch = lowerSql.match(/into\s+([a-z0-9_\.]+)/i)
        if (intoMatch && intoMatch[1])
          tables.push(intoMatch[1].replace(/`/g, '').split('.').pop()!)
        break

      case 'UPDATE':
        // Usually the table name follows UPDATE
        const updateMatch = lowerSql.match(/update\s+([a-z0-9_\.]+)/i)
        if (updateMatch && updateMatch[1])
          tables.push(updateMatch[1].replace(/`/g, '').split('.').pop()!)
        break

      case 'DELETE':
        // Look for FROM clause after DELETE
        const deleteFromMatch = lowerSql.match(/from\s+([a-z0-9_\.]+)/i)
        if (deleteFromMatch && deleteFromMatch[1])
          tables.push(deleteFromMatch[1].replace(/`/g, '').split('.').pop()!)
        break
    }
  } catch (error) {
    // Just return whatever we've got so far
  }

  // Remove duplicates and return
  return [...new Set(tables)].filter(Boolean)
}

/**
 * Normalize a SQL query by replacing literal values with placeholders
 */
function normalizeQuery(sql: string, type: string): string {
  try {
    let normalizedSql = sql

    // Replace numeric literals with ?
    normalizedSql = normalizedSql.replace(/\b\d+\b/g, '?')

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
  } catch (error) {
    // In case of an error, return the original
    return sql
  }
}