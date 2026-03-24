import { describe, expect, test } from 'bun:test'
import { sqlHelpers } from '../src/sql-helpers'
import type { SqlDialectHelpers } from '../src/sql-helpers'

// ============================================================================
// Interface / shape tests
// ============================================================================

describe('sqlHelpers - return shape', () => {
  test('returns an object matching SqlDialectHelpers interface', () => {
    const h = sqlHelpers('sqlite')
    expect(h).toHaveProperty('driver')
    expect(h).toHaveProperty('isPostgres')
    expect(h).toHaveProperty('isMysql')
    expect(h).toHaveProperty('isSqlite')
    expect(h).toHaveProperty('now')
    expect(h).toHaveProperty('boolTrue')
    expect(h).toHaveProperty('boolFalse')
    expect(h).toHaveProperty('autoIncrement')
    expect(h).toHaveProperty('primaryKey')
    expect(typeof h.param).toBe('function')
    expect(typeof h.params).toBe('function')
  })

  test('stores the driver string it was created with', () => {
    expect(sqlHelpers('postgres').driver).toBe('postgres')
    expect(sqlHelpers('mysql').driver).toBe('mysql')
    expect(sqlHelpers('sqlite').driver).toBe('sqlite')
  })
})

// ============================================================================
// SQLite tests
// ============================================================================

describe('sqlHelpers - sqlite driver', () => {
  const h = sqlHelpers('sqlite')

  test('isSqlite is true, others false', () => {
    expect(h.isSqlite).toBe(true)
    expect(h.isPostgres).toBe(false)
    expect(h.isMysql).toBe(false)
  })

  test('now() returns sqlite datetime expression', () => {
    expect(h.now).toBe(`datetime('now')`)
  })

  test('boolTrue is "1", boolFalse is "0"', () => {
    expect(h.boolTrue).toBe('1')
    expect(h.boolFalse).toBe('0')
  })

  test('autoIncrement returns INTEGER', () => {
    expect(h.autoIncrement).toBe('INTEGER')
  })

  test('primaryKey includes AUTOINCREMENT', () => {
    expect(h.primaryKey).toBe('PRIMARY KEY AUTOINCREMENT')
  })

  test('param() always returns ? regardless of index', () => {
    expect(h.param(1)).toBe('?')
    expect(h.param(2)).toBe('?')
    expect(h.param(99)).toBe('?')
  })

  test('params() returns ?, ?, ? placeholders', () => {
    const result = h.params('a', 'b', 'c')
    expect(result.sql).toBe('?, ?, ?')
    expect(result.values).toEqual(['a', 'b', 'c'])
  })

  test('params() with single value', () => {
    const result = h.params(42)
    expect(result.sql).toBe('?')
    expect(result.values).toEqual([42])
  })

  test('params() with no values returns empty', () => {
    const result = h.params()
    expect(result.sql).toBe('')
    expect(result.values).toEqual([])
  })
})

// ============================================================================
// PostgreSQL tests
// ============================================================================

describe('sqlHelpers - postgres driver', () => {
  const h = sqlHelpers('postgres')

  test('isPostgres is true, others false', () => {
    expect(h.isPostgres).toBe(true)
    expect(h.isMysql).toBe(false)
    expect(h.isSqlite).toBe(false)
  })

  test('now() returns NOW()', () => {
    expect(h.now).toBe('NOW()')
  })

  test('boolTrue is "true", boolFalse is "false"', () => {
    expect(h.boolTrue).toBe('true')
    expect(h.boolFalse).toBe('false')
  })

  test('autoIncrement returns SERIAL', () => {
    expect(h.autoIncrement).toBe('SERIAL')
  })

  test('primaryKey is just PRIMARY KEY (no auto-increment keyword)', () => {
    expect(h.primaryKey).toBe('PRIMARY KEY')
  })

  test('param() returns $N positional placeholders', () => {
    expect(h.param(1)).toBe('$1')
    expect(h.param(2)).toBe('$2')
    expect(h.param(10)).toBe('$10')
  })

  test('params() returns $1, $2, $3 placeholders', () => {
    const result = h.params('x', 'y', 'z')
    expect(result.sql).toBe('$1, $2, $3')
    expect(result.values).toEqual(['x', 'y', 'z'])
  })

  test('params() with single value', () => {
    const result = h.params(100)
    expect(result.sql).toBe('$1')
    expect(result.values).toEqual([100])
  })

  test('params() with no values returns empty', () => {
    const result = h.params()
    expect(result.sql).toBe('')
    expect(result.values).toEqual([])
  })
})

// ============================================================================
// MySQL tests
// ============================================================================

describe('sqlHelpers - mysql driver', () => {
  const h = sqlHelpers('mysql')

  test('isMysql is true, others false', () => {
    expect(h.isMysql).toBe(true)
    expect(h.isPostgres).toBe(false)
    expect(h.isSqlite).toBe(false)
  })

  test('now() returns NOW()', () => {
    expect(h.now).toBe('NOW()')
  })

  test('boolTrue is "1", boolFalse is "0"', () => {
    expect(h.boolTrue).toBe('1')
    expect(h.boolFalse).toBe('0')
  })

  test('autoIncrement returns INTEGER', () => {
    expect(h.autoIncrement).toBe('INTEGER')
  })

  test('primaryKey includes AUTO_INCREMENT', () => {
    expect(h.primaryKey).toBe('PRIMARY KEY AUTO_INCREMENT')
  })

  test('param() returns ? for all indices', () => {
    expect(h.param(1)).toBe('?')
    expect(h.param(5)).toBe('?')
  })

  test('params() returns ? placeholders like sqlite', () => {
    const result = h.params('a', 'b')
    expect(result.sql).toBe('?, ?')
    expect(result.values).toEqual(['a', 'b'])
  })
})

// ============================================================================
// Unknown / fallback driver tests
// ============================================================================

describe('sqlHelpers - unknown driver defaults to sqlite-like behavior', () => {
  const h = sqlHelpers('unknown_db')

  test('treats unknown driver as SQLite', () => {
    expect(h.isSqlite).toBe(true)
    expect(h.isPostgres).toBe(false)
    expect(h.isMysql).toBe(false)
  })

  test('now() returns sqlite datetime expression', () => {
    expect(h.now).toBe(`datetime('now')`)
  })

  test('boolTrue/boolFalse use numeric values', () => {
    expect(h.boolTrue).toBe('1')
    expect(h.boolFalse).toBe('0')
  })

  test('param() returns ?', () => {
    expect(h.param(1)).toBe('?')
  })

  test('params() returns ? placeholders', () => {
    const result = h.params('val')
    expect(result.sql).toBe('?')
    expect(result.values).toEqual(['val'])
  })
})

// ============================================================================
// Cross-driver comparison tests
// ============================================================================

describe('sqlHelpers - cross-driver comparisons', () => {
  test('now() differs between postgres/mysql and sqlite', () => {
    const pg = sqlHelpers('postgres')
    const my = sqlHelpers('mysql')
    const sq = sqlHelpers('sqlite')

    expect(pg.now).toBe(my.now)
    expect(pg.now).not.toBe(sq.now)
  })

  test('boolTrue/boolFalse: postgres uses true/false, mysql and sqlite use 1/0', () => {
    const pg = sqlHelpers('postgres')
    const my = sqlHelpers('mysql')
    const sq = sqlHelpers('sqlite')

    expect(pg.boolTrue).toBe('true')
    expect(pg.boolFalse).toBe('false')
    expect(my.boolTrue).toBe('1')
    expect(my.boolFalse).toBe('0')
    expect(sq.boolTrue).toBe('1')
    expect(sq.boolFalse).toBe('0')
  })

  test('param() differs only for postgres', () => {
    const pg = sqlHelpers('postgres')
    const my = sqlHelpers('mysql')
    const sq = sqlHelpers('sqlite')

    expect(pg.param(3)).toBe('$3')
    expect(my.param(3)).toBe('?')
    expect(sq.param(3)).toBe('?')
  })

  test('autoIncrement: postgres uses SERIAL, others use INTEGER', () => {
    expect(sqlHelpers('postgres').autoIncrement).toBe('SERIAL')
    expect(sqlHelpers('mysql').autoIncrement).toBe('INTEGER')
    expect(sqlHelpers('sqlite').autoIncrement).toBe('INTEGER')
  })

  test('each driver has a distinct primaryKey syntax', () => {
    const pg = sqlHelpers('postgres').primaryKey
    const my = sqlHelpers('mysql').primaryKey
    const sq = sqlHelpers('sqlite').primaryKey

    expect(pg).not.toBe(my)
    expect(my).not.toBe(sq)
    expect(pg).not.toBe(sq)
  })
})

// ============================================================================
// Edge cases
// ============================================================================

describe('sqlHelpers - edge cases', () => {
  test('params() preserves value types (null, undefined, numbers, booleans)', () => {
    const h = sqlHelpers('postgres')
    const result = h.params(null, undefined, 0, false, '')
    expect(result.values).toEqual([null, undefined, 0, false, ''])
    expect(result.sql).toBe('$1, $2, $3, $4, $5')
  })

  test('params() with many values generates correct count', () => {
    const h = sqlHelpers('postgres')
    const values = Array.from({ length: 20 }, (_, i) => i)
    const result = h.params(...values)
    const placeholders = result.sql.split(', ')
    expect(placeholders).toHaveLength(20)
    expect(placeholders[0]).toBe('$1')
    expect(placeholders[19]).toBe('$20')
  })

  test('empty string driver defaults to sqlite behavior', () => {
    const h = sqlHelpers('')
    expect(h.isSqlite).toBe(true)
    expect(h.isPostgres).toBe(false)
    expect(h.isMysql).toBe(false)
  })
})
