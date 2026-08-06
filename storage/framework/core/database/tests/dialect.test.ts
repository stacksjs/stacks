// Dialect capability table (`src/dialect.ts`).
//
// The invariant these tests protect is the split between what a dialect
// SPEAKS (wire protocol, which governs SQL rendering) and what it ACCEPTS
// (DDL features). Collapsing the two into a single "is MySQL" boolean is the
// bug this table was introduced to prevent: SingleStore renders exactly like
// MySQL and rejects its foreign keys, so any code that reads `isMysql` and
// concludes "foreign keys are fine" is wrong.
//
// The fallback behavior is also pinned. Unknown dialects resolve to SQLite
// rather than throwing, matching what every call site did before
// (`isSqlite = !isPostgres && !isMysql`), so a misconfigured DB_CONNECTION
// stays a runtime connection error and does not become a module-load crash.

import { describe, expect, test } from 'bun:test'
import {
  dialectCapabilities,
  isKnownDialect,
  isMysqlWire,
  isPostgresWire,
  isVitessSharded,
  knownDialects,
  toQueryBuilderDialect,
  toSqlIntrospectionDialect,
} from '../src/dialect'
import { sqlHelpers } from '../src/sql-helpers'

describe('dialectCapabilities', () => {
  test('maps proxy drivers to their physical catalogue family', () => {
    expect(toSqlIntrospectionDialect('vitess')).toBe('mysql')
    expect(toSqlIntrospectionDialect('singlestore')).toBe('mysql')
    expect(toSqlIntrospectionDialect('postgres')).toBe('postgres')
    expect(toSqlIntrospectionDialect('unknown')).toBe('other')
  })

  test('every known dialect has a self-consistent row', () => {
    for (const name of knownDialects()) {
      const caps = dialectCapabilities(name)
      expect(caps.dialect).toBe(name)
      // A MySQL-wire dialect must quote with backticks; anything else uses
      // double quotes. Getting this pair out of sync emits DDL the server
      // rejects at execution time.
      expect(caps.identifierQuote).toBe(caps.wire === 'mysql' ? '`' : '"')
      // Networked dialects need a port; embedded ones must not claim one.
      if (caps.wire === 'sqlite')
        expect(caps.defaultPort).toBeUndefined()
      else
        expect(typeof caps.defaultPort).toBe('number')
    }
  })

  test('unknown dialects fall back to sqlite rather than throwing', () => {
    expect(dialectCapabilities('cockroach').wire).toBe('sqlite')
    expect(dialectCapabilities('').wire).toBe('sqlite')
    expect(isKnownDialect('cockroach')).toBe(false)
    expect(isKnownDialect('mysql')).toBe(true)
  })
})

describe('wire protocol vs feature set', () => {
  test('reads typed and dotenv Vitess topology values identically', () => {
    expect(isVitessSharded(false)).toBe(false)
    expect(isVitessSharded('false')).toBe(false)
    expect(isVitessSharded('0')).toBe(false)
    expect(isVitessSharded(true)).toBe(true)
    expect(isVitessSharded('true')).toBe(true)
  })

  test('singlestore renders as MySQL but rejects foreign keys', () => {
    // The exact conflation this table exists to prevent.
    expect(isMysqlWire('singlestore')).toBe(true)
    expect(dialectCapabilities('singlestore').supportsForeignKeys).toBe(false)
    expect(dialectCapabilities('mysql').supportsForeignKeys).toBe(true)
  })

  test('classifies wire protocols', () => {
    expect(isMysqlWire('mysql')).toBe(true)
    expect(isMysqlWire('singlestore')).toBe(true)
    expect(isMysqlWire('postgres')).toBe(false)
    expect(isMysqlWire('sqlite')).toBe(false)

    expect(isPostgresWire('postgres')).toBe(true)
    expect(isPostgresWire('mysql')).toBe(false)
  })
})

describe('toQueryBuilderDialect', () => {
  test('passes through dialects the query builder renders natively', () => {
    expect(toQueryBuilderDialect('sqlite')).toBe('sqlite')
    expect(toQueryBuilderDialect('mysql')).toBe('mysql')
    expect(toQueryBuilderDialect('singlestore')).toBe('singlestore')
    expect(toQueryBuilderDialect('vitess')).toBe('vitess')
    expect(toQueryBuilderDialect('postgres')).toBe('postgres')
  })

  test('unknown dialects collapse to sqlite', () => {
    expect(toQueryBuilderDialect('nonsense')).toBe('sqlite')
  })
})

describe('sqlHelpers delegates to the capability table', () => {
  test('MySQL-wire dialects all render MySQL SQL, not the SQLite fallback', () => {
    // The pre-table failure mode: a MySQL-wire dialect missing from one
    // inline `=== 'mysql' || === 'singlestore'` check silently emitted
    // `datetime('now')` and AUTOINCREMENT at a MySQL server.
    // Asserted against MySQL's own output rather than literals: the property
    // is "every MySQL-wire dialect renders identically to mysql", and pinning
    // the literals makes this fail whenever MySQL's rendering is legitimately
    // changed elsewhere (as it was when nullable timestamps moved from
    // TIMESTAMP to DATETIME) even though the invariant still holds.
    const mysql = sqlHelpers('mysql')
    for (const dialect of knownDialects().filter(isMysqlWire)) {
      const h = sqlHelpers(dialect)
      expect(h.isMysql).toBe(true)
      expect(h.isSqlite).toBe(false)
      expect(h.isPostgres).toBe(false)
      expect(h.now).toBe(mysql.now)
      expect(h.nullableTimestamp).toBe(mysql.nullableTimestamp)
      expect(h.param(1)).toBe(mysql.param(1))
    }
  })

  test('existing per-dialect rendering is unchanged', () => {
    expect(sqlHelpers('postgres').now).toBe('NOW()')
    expect(sqlHelpers('sqlite').now).toBe(`datetime('now')`)
    expect(sqlHelpers('postgres').param(2)).toBe('$2')
    expect(sqlHelpers('postgres').boolTrue).toBe('true')
    expect(sqlHelpers('mysql').boolTrue).toBe('1')
  })

  test('unknown drivers still take the sqlite path', () => {
    const h = sqlHelpers('cockroach')
    expect(h.isSqlite).toBe(true)
    expect(h.now).toBe(`datetime('now')`)
  })
})
