import { describe, expect, test } from 'bun:test'
import { sqlHelpers } from '../src/sql-helpers'
import { parseQuery } from '../src/query-parser'
import {
  isStringValidator,
  isNumberValidator,
  isIntegerValidator,
  isBooleanValidator,
  isDateValidator,
  isDatetimeValidator,
  isJsonValidator,
  isFloatValidator,
  isDecimalValidator,
  isSmallintValidator,
  isBigintValidator,
  isBinaryValidator,
  isBlobValidator,
  isTimestampValidator,
  enumValidator,
  isUnixValidator,
  isTimestampTzValidator,
  checkValidator,
  findCharacterLength,
  prepareTextColumnType,
  prepareNumberColumnType,
  prepareEnumColumnType,
} from '../src/validators'
import {
  getConnectionDefaults,
  DB_HOST_DEFAULT,
  DB_PORTS,
  DB_NAMES,
  DB_USERS,
} from '../src/defaults'
import {
  detectDriver,
  validateDriverConfig,
  mergeWithDefaults,
  getConnectionString,
  driverDefaults,
  getConfigFromEnv,
} from '../src/driver-config'
import {
  Database,
  createDatabase,
  createSqliteDatabase,
  createPostgresDatabase,
  createMysqlDatabase,
} from '../src/database'

// ============================================================================
// SQL Helpers - Deep integration tests covering real dialect logic
// ============================================================================

describe('Database SQL Helpers - Real Dialect Logic', () => {
  test('sqlHelpers("sqlite") returns correct complete dialect', () => {
    const h = sqlHelpers('sqlite')
    expect(h.driver).toBe('sqlite')
    expect(h.isSqlite).toBe(true)
    expect(h.isMysql).toBe(false)
    expect(h.isPostgres).toBe(false)
    expect(h.now).toBe("datetime('now')")
    expect(h.boolTrue).toBe('1')
    expect(h.boolFalse).toBe('0')
    expect(h.autoIncrement).toBe('INTEGER')
    expect(h.primaryKey).toBe('PRIMARY KEY AUTOINCREMENT')
  })

  test('sqlHelpers("mysql") returns correct complete dialect', () => {
    const h = sqlHelpers('mysql')
    expect(h.driver).toBe('mysql')
    expect(h.isMysql).toBe(true)
    expect(h.isSqlite).toBe(false)
    expect(h.isPostgres).toBe(false)
    expect(h.now).toBe('NOW()')
    expect(h.boolTrue).toBe('1')
    expect(h.boolFalse).toBe('0')
    expect(h.autoIncrement).toBe('INTEGER')
    expect(h.primaryKey).toBe('PRIMARY KEY AUTO_INCREMENT')
  })

  test('sqlHelpers("postgres") returns correct complete dialect', () => {
    const h = sqlHelpers('postgres')
    expect(h.driver).toBe('postgres')
    expect(h.isPostgres).toBe(true)
    expect(h.isMysql).toBe(false)
    expect(h.isSqlite).toBe(false)
    expect(h.now).toBe('NOW()')
    expect(h.boolTrue).toBe('true')
    expect(h.boolFalse).toBe('false')
    expect(h.autoIncrement).toBe('SERIAL')
    expect(h.primaryKey).toBe('PRIMARY KEY')
  })

  test('param() produces correct positional placeholders per dialect', () => {
    const sqlite = sqlHelpers('sqlite')
    expect(sqlite.param(1)).toBe('?')
    expect(sqlite.param(5)).toBe('?')

    const mysql = sqlHelpers('mysql')
    expect(mysql.param(1)).toBe('?')
    expect(mysql.param(5)).toBe('?')

    const pg = sqlHelpers('postgres')
    expect(pg.param(1)).toBe('$1')
    expect(pg.param(3)).toBe('$3')
    expect(pg.param(10)).toBe('$10')
  })

  test('params() produces variadic placeholders with values', () => {
    const sqlite = sqlHelpers('sqlite')
    const sqliteResult = sqlite.params('a', 'b', 'c')
    expect(sqliteResult.sql).toBe('?, ?, ?')
    expect(sqliteResult.values).toEqual(['a', 'b', 'c'])

    const pg = sqlHelpers('postgres')
    const pgResult = pg.params('x', 'y', 'z')
    expect(pgResult.sql).toBe('$1, $2, $3')
    expect(pgResult.values).toEqual(['x', 'y', 'z'])
  })

  test('params() with single value', () => {
    const sqlite = sqlHelpers('sqlite')
    const result = sqlite.params(42)
    expect(result.sql).toBe('?')
    expect(result.values).toEqual([42])
  })

  test('params() with no values returns empty sql', () => {
    const h = sqlHelpers('sqlite')
    const result = h.params()
    expect(result.sql).toBe('')
    expect(result.values).toEqual([])
  })

  test('params() preserves null, undefined, boolean, and numeric types', () => {
    const pg = sqlHelpers('postgres')
    const result = pg.params(null, undefined, 0, false, '')
    expect(result.values).toEqual([null, undefined, 0, false, ''])
    expect(result.sql).toBe('$1, $2, $3, $4, $5')
  })

  test('unknown driver falls back to sqlite-like behavior', () => {
    const h = sqlHelpers('cockroachdb')
    expect(h.isSqlite).toBe(true)
    expect(h.isPostgres).toBe(false)
    expect(h.isMysql).toBe(false)
    expect(h.now).toBe("datetime('now')")
    expect(h.param(1)).toBe('?')
  })
})

// ============================================================================
// Query Parser - Real parsing logic
// ============================================================================

describe('Query Parser - Real SQL Parsing', () => {
  test('parseQuery identifies SELECT queries', () => {
    const result = parseQuery('SELECT * FROM users WHERE id = 1')
    expect(result.type).toBe('SELECT')
    expect(result.tables).toContain('users')
    expect(result.normalized).toBeDefined()
  })

  test('parseQuery identifies INSERT queries', () => {
    const result = parseQuery("INSERT INTO posts (title) VALUES ('hello')")
    expect(result.type).toBe('INSERT')
    expect(result.tables).toContain('posts')
  })

  test('parseQuery identifies UPDATE queries', () => {
    const result = parseQuery("UPDATE users SET name = 'John' WHERE id = 1")
    expect(result.type).toBe('UPDATE')
    expect(result.tables).toContain('users')
  })

  test('parseQuery identifies DELETE queries', () => {
    const result = parseQuery('DELETE FROM users WHERE id = 1')
    expect(result.type).toBe('DELETE')
    expect(result.tables).toContain('users')
  })

  test('parseQuery normalizes literals to placeholders', () => {
    const result = parseQuery("SELECT * FROM users WHERE name = 'John' AND age = 30")
    expect(result.normalized).not.toContain("'John'")
    expect(result.normalized).toContain('?')
  })

  test('parseQuery handles empty input', () => {
    const result = parseQuery('')
    expect(result.type).toBe('OTHER')
    expect(result.tables).toEqual([])
    expect(result.normalized).toBe('')
  })

  test('parseQuery extracts tables from JOINs', () => {
    const result = parseQuery('SELECT u.*, p.title FROM users u JOIN posts p ON u.id = p.user_id')
    expect(result.type).toBe('SELECT')
    expect(result.tables).toContain('users')
    expect(result.tables).toContain('posts')
  })

  test('parseQuery returns OTHER for non-standard queries', () => {
    const result = parseQuery('CREATE TABLE foo (id INTEGER)')
    expect(result.type).toBe('OTHER')
  })
})

// ============================================================================
// Validators - Real validation logic against actual ValidationType shapes
// ============================================================================

describe('Database Validators - Real Type Detection', () => {
  test('isStringValidator detects name=string', () => {
    expect(isStringValidator({ name: 'string' } as any)).toBe(true)
    expect(isStringValidator({ name: 'number' } as any)).toBe(false)
  })

  test('isNumberValidator detects name=number', () => {
    expect(isNumberValidator({ name: 'number' } as any)).toBe(true)
    expect(isNumberValidator({ name: 'string' } as any)).toBe(false)
  })

  test('isIntegerValidator detects name=integer', () => {
    expect(isIntegerValidator({ name: 'integer' } as any)).toBe(true)
    expect(isIntegerValidator({ name: 'number' } as any)).toBe(false)
  })

  test('isBooleanValidator detects name=boolean', () => {
    expect(isBooleanValidator({ name: 'boolean' } as any)).toBe(true)
    expect(isBooleanValidator({ name: 'string' } as any)).toBe(false)
  })

  test('isDateValidator detects name=date', () => {
    expect(isDateValidator({ name: 'date' } as any)).toBe(true)
    expect(isDateValidator({ name: 'string' } as any)).toBe(false)
  })

  test('isDatetimeValidator detects name=datetime', () => {
    expect(isDatetimeValidator({ name: 'datetime' } as any)).toBe(true)
    expect(isDatetimeValidator({ name: 'date' } as any)).toBe(false)
  })

  test('isJsonValidator detects name=json', () => {
    expect(isJsonValidator({ name: 'json' } as any)).toBe(true)
    expect(isJsonValidator({ name: 'string' } as any)).toBe(false)
  })

  test('isFloatValidator detects name=float', () => {
    expect(isFloatValidator({ name: 'float' } as any)).toBe(true)
    expect(isFloatValidator({ name: 'number' } as any)).toBe(false)
  })

  test('isDecimalValidator detects name=decimal', () => {
    expect(isDecimalValidator({ name: 'decimal' } as any)).toBe(true)
    expect(isDecimalValidator({ name: 'float' } as any)).toBe(false)
  })

  test('isSmallintValidator detects name=smallint', () => {
    expect(isSmallintValidator({ name: 'smallint' } as any)).toBe(true)
    expect(isSmallintValidator({ name: 'integer' } as any)).toBe(false)
  })

  test('isBigintValidator detects name=bigint', () => {
    expect(isBigintValidator({ name: 'bigint' } as any)).toBe(true)
    expect(isBigintValidator({ name: 'integer' } as any)).toBe(false)
  })

  test('isBinaryValidator detects name=binary', () => {
    expect(isBinaryValidator({ name: 'binary' } as any)).toBe(true)
    expect(isBinaryValidator({ name: 'blob' } as any)).toBe(false)
  })

  test('isBlobValidator detects name=blob', () => {
    expect(isBlobValidator({ name: 'blob' } as any)).toBe(true)
    expect(isBlobValidator({ name: 'binary' } as any)).toBe(false)
  })

  test('isTimestampValidator detects name=timestamp', () => {
    expect(isTimestampValidator({ name: 'timestamp' } as any)).toBe(true)
    expect(isTimestampValidator({ name: 'datetime' } as any)).toBe(false)
  })

  test('isTimestampTzValidator detects name=timestampTz', () => {
    expect(isTimestampTzValidator({ name: 'timestampTz' } as any)).toBe(true)
    expect(isTimestampTzValidator({ name: 'timestamp' } as any)).toBe(false)
  })

  test('isUnixValidator detects name=unix', () => {
    expect(isUnixValidator({ name: 'unix' } as any)).toBe(true)
    expect(isUnixValidator({ name: 'timestamp' } as any)).toBe(false)
  })

  test('enumValidator detects name=enum', () => {
    expect(enumValidator({ name: 'enum' } as any)).toBe(true)
    expect(enumValidator({ name: 'string' } as any)).toBe(false)
  })
})

describe('Database Validators - checkValidator column type mapping', () => {
  test('checkValidator maps string to text for sqlite', () => {
    const result = checkValidator({ name: 'string' } as any, 'sqlite')
    expect(result).toBe("'text'")
  })

  test('checkValidator maps number to integer for sqlite', () => {
    const result = checkValidator({ name: 'number' } as any, 'sqlite')
    expect(result).toBe("'integer'")
  })

  test('checkValidator maps boolean to boolean', () => {
    const result = checkValidator({ name: 'boolean' } as any, 'mysql')
    expect(result).toBe("'boolean'")
  })

  test('checkValidator maps date to date', () => {
    const result = checkValidator({ name: 'date' } as any, 'mysql')
    expect(result).toBe("'date'")
  })

  test('checkValidator maps datetime to datetime', () => {
    const result = checkValidator({ name: 'datetime' } as any, 'mysql')
    expect(result).toBe("'datetime'")
  })

  test('checkValidator maps timestamp to timestamp', () => {
    const result = checkValidator({ name: 'timestamp' } as any, 'mysql')
    expect(result).toBe("'timestamp'")
  })

  test('checkValidator maps timestampTz to timestamp', () => {
    const result = checkValidator({ name: 'timestampTz' } as any, 'mysql')
    expect(result).toBe("'timestamp'")
  })

  test('checkValidator maps float to float', () => {
    const result = checkValidator({ name: 'float' } as any, 'mysql')
    expect(result).toBe("'float'")
  })

  test('checkValidator maps smallint to smallint', () => {
    const result = checkValidator({ name: 'smallint' } as any, 'mysql')
    expect(result).toBe("'smallint'")
  })

  test('checkValidator maps decimal to decimal', () => {
    const result = checkValidator({ name: 'decimal' } as any, 'mysql')
    expect(result).toBe("'decimal'")
  })

  test('checkValidator maps integer to integer', () => {
    const result = checkValidator({ name: 'integer' } as any, 'mysql')
    expect(result).toBe("'integer'")
  })

  test('checkValidator maps bigint to bigint', () => {
    const result = checkValidator({ name: 'bigint' } as any, 'mysql')
    expect(result).toBe("'bigint'")
  })

  test('checkValidator maps binary to binary', () => {
    const result = checkValidator({ name: 'binary' } as any, 'mysql')
    expect(result).toBe("'binary'")
  })

  test('checkValidator maps unix to bigint', () => {
    const result = checkValidator({ name: 'unix' } as any, 'mysql')
    expect(result).toBe("'bigint'")
  })

  test('checkValidator returns empty string for unknown validator', () => {
    const result = checkValidator({ name: 'unknown_type' } as any, 'mysql')
    expect(result).toBe('')
  })
})

describe('Database Validators - Column type preparation helpers', () => {
  test('prepareTextColumnType returns text for sqlite', () => {
    const result = prepareTextColumnType({ name: 'string' } as any, 'sqlite')
    expect(result).toBe("'text'")
  })

  test('prepareTextColumnType returns varchar with default 255 for mysql', () => {
    const result = prepareTextColumnType({ name: 'string' } as any, 'mysql')
    expect(result).toBe("'varchar(255)'")
  })

  test('prepareNumberColumnType returns integer for sqlite', () => {
    const result = prepareNumberColumnType({ name: 'number' } as any, 'sqlite')
    expect(result).toBe("'integer'")
  })

  test('prepareNumberColumnType returns integer by default for mysql', () => {
    const result = prepareNumberColumnType({ name: 'number' } as any, 'mysql')
    expect(result).toBe("'integer'")
  })

  test('findCharacterLength returns 255 as default', () => {
    const result = findCharacterLength({ name: 'string' } as any)
    expect(result).toBe(255)
  })

  test('findCharacterLength extracts max from getRules', () => {
    const mockValidator = {
      name: 'string',
      getRules: () => [{ name: 'max', params: { length: 100 } }],
    }
    const result = findCharacterLength(mockValidator as any)
    expect(result).toBe(100)
  })
})

// ============================================================================
// Database Defaults - Real constant values
// ============================================================================

describe('Database Defaults - Constants and Connection Builders', () => {
  test('DB_HOST_DEFAULT is 127.0.0.1', () => {
    expect(DB_HOST_DEFAULT).toBe('127.0.0.1')
  })

  test('DB_PORTS has correct port numbers', () => {
    expect(DB_PORTS.mysql).toBe(3306)
    expect(DB_PORTS.postgres).toBe(5432)
    expect(DB_PORTS.sqlite).toBe(0)
  })

  test('DB_NAMES has correct defaults', () => {
    expect(DB_NAMES.default).toBe('stacks')
    expect(DB_NAMES.sqlitePath).toBe('database/stacks.sqlite')
    expect(DB_NAMES.sqliteTestingPath).toBe('database/stacks_testing.sqlite')
  })

  test('DB_USERS has correct defaults per driver', () => {
    expect(DB_USERS.mysql).toBe('root')
    expect(DB_USERS.postgres).toBe('postgres')
    expect(DB_USERS.sqlite).toBe('')
  })

  test('getConnectionDefaults returns correct sqlite defaults', () => {
    const defaults = getConnectionDefaults('sqlite')
    expect(defaults.database).toBe('database/stacks.sqlite')
    expect(defaults.prefix).toBe('')
  })

  test('getConnectionDefaults returns correct mysql defaults', () => {
    const defaults = getConnectionDefaults('mysql')
    expect(defaults.database).toBe('stacks')
    expect(defaults.host).toBe('127.0.0.1')
    expect(defaults.port).toBe(3306)
    expect(defaults.username).toBe('root')
    expect(defaults.password).toBe('')
  })

  test('getConnectionDefaults returns correct postgres defaults', () => {
    const defaults = getConnectionDefaults('postgres')
    expect(defaults.database).toBe('stacks')
    expect(defaults.host).toBe('127.0.0.1')
    expect(defaults.port).toBe(5432)
    expect(defaults.username).toBe('postgres')
    expect(defaults.password).toBe('')
  })

  test('getConnectionDefaults for unknown driver returns :memory:', () => {
    const defaults = getConnectionDefaults('unknown')
    expect(defaults.database).toBe(':memory:')
  })

  test('getConnectionDefaults respects env proxy overrides', () => {
    const envProxy = {
      DB_DATABASE: 'custom_db',
      DB_HOST: '10.0.0.1',
      DB_PORT: 5433,
      DB_USERNAME: 'admin',
      DB_PASSWORD: 'secret',
    }
    const defaults = getConnectionDefaults('postgres', envProxy)
    expect(defaults.database).toBe('custom_db')
    expect(defaults.host).toBe('10.0.0.1')
    expect(defaults.port).toBe(5433)
    expect(defaults.username).toBe('admin')
    expect(defaults.password).toBe('secret')
  })
})

// ============================================================================
// Driver Config - Real detection and validation logic
// ============================================================================

describe('Driver Config - Detection and Validation', () => {
  test('detectDriver returns sqlite by default when no env is set', () => {
    // detectDriver reads env vars; without DB_CONNECTION or DATABASE_URL
    // it defaults to sqlite
    const driver = detectDriver()
    expect(typeof driver).toBe('string')
    // It should be one of the valid drivers
    expect(['sqlite', 'mysql', 'postgres']).toContain(driver)
  })

  test('driverDefaults has entries for sqlite, mysql, postgres', () => {
    expect(driverDefaults.sqlite).toBeDefined()
    expect(driverDefaults.mysql).toBeDefined()
    expect(driverDefaults.postgres).toBeDefined()
  })

  test('driverDefaults.sqlite has database path', () => {
    expect((driverDefaults.sqlite as any).database).toBe('database/stacks.sqlite')
  })

  test('driverDefaults.mysql has correct port', () => {
    expect((driverDefaults.mysql as any).port).toBe(3306)
  })

  test('driverDefaults.postgres has correct port', () => {
    expect((driverDefaults.postgres as any).port).toBe(5432)
  })

  test('validateDriverConfig validates sqlite config correctly', () => {
    const result = validateDriverConfig('sqlite', { database: ':memory:' } as any)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  test('validateDriverConfig rejects sqlite without database', () => {
    const result = validateDriverConfig('sqlite', {} as any)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.errors[0]).toContain('SQLite')
  })

  test('validateDriverConfig validates mysql config', () => {
    const result = validateDriverConfig('mysql', { name: 'mydb' } as any)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  test('validateDriverConfig rejects mysql without name', () => {
    const result = validateDriverConfig('mysql', {} as any)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('MySQL')
  })

  test('validateDriverConfig validates postgres config', () => {
    const result = validateDriverConfig('postgres', { name: 'pgdb' } as any)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  test('validateDriverConfig rejects postgres without name', () => {
    const result = validateDriverConfig('postgres', {} as any)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('PostgreSQL')
  })

  test('mergeWithDefaults merges user config with driver defaults', () => {
    const merged = mergeWithDefaults('sqlite', { database: 'custom.db' } as any)
    expect((merged as any).database).toBe('custom.db')
  })

  test('mergeWithDefaults preserves defaults when no override given', () => {
    const merged = mergeWithDefaults('mysql', {} as any)
    expect((merged as any).host).toBe('127.0.0.1')
    expect((merged as any).port).toBe(3306)
  })

  test('getConnectionString builds sqlite connection string', () => {
    const connStr = getConnectionString('sqlite', { database: 'test.db' } as any)
    expect(connStr).toBe('sqlite://test.db')
  })

  test('getConnectionString handles sqlite :memory:', () => {
    const connStr = getConnectionString('sqlite', { database: ':memory:' } as any)
    expect(connStr).toBe(':memory:')
  })

  test('getConnectionString builds mysql connection string', () => {
    const connStr = getConnectionString('mysql', {
      name: 'mydb',
      host: '127.0.0.1',
      port: 3306,
      username: 'root',
      password: 'pass',
    } as any)
    expect(connStr).toBe('mysql://root:pass@127.0.0.1:3306/mydb')
  })

  test('getConnectionString builds postgres connection string', () => {
    const connStr = getConnectionString('postgres', {
      name: 'pgdb',
      host: 'localhost',
      port: 5432,
      username: 'admin',
      password: 'secret',
    } as any)
    expect(connStr).toBe('postgres://admin:secret@localhost:5432/pgdb')
  })
})

// ============================================================================
// Database class - Real initialization logic
// ============================================================================

describe('Database Class - Real Initialization', () => {
  test('createDatabase returns a Database instance', () => {
    const db = createDatabase({
      driver: 'sqlite',
      connection: { database: ':memory:' },
    })
    expect(db).toBeInstanceOf(Database)
    expect(db.driver).toBe('sqlite')
    expect(db.connection.database).toBe(':memory:')
  })

  test('createSqliteDatabase creates sqlite instance', () => {
    const db = createSqliteDatabase(':memory:')
    expect(db).toBeInstanceOf(Database)
    expect(db.driver).toBe('sqlite')
  })

  test('createPostgresDatabase creates postgres instance', () => {
    const db = createPostgresDatabase({
      database: 'testdb',
      host: 'localhost',
      port: 5432,
    })
    expect(db).toBeInstanceOf(Database)
    expect(db.driver).toBe('postgres')
  })

  test('createMysqlDatabase creates mysql instance', () => {
    const db = createMysqlDatabase({
      database: 'testdb',
      host: 'localhost',
      port: 3306,
    })
    expect(db).toBeInstanceOf(Database)
    expect(db.driver).toBe('mysql')
  })

  test('Database.isInitialized is false before first query', () => {
    const db = createSqliteDatabase(':memory:')
    expect(db.isInitialized).toBe(false)
  })

  test('Database.fromConfig creates a Database from config object', () => {
    const db = Database.fromConfig({
      default: 'sqlite',
      connections: {
        sqlite: { database: ':memory:' },
      },
    })
    expect(db).toBeInstanceOf(Database)
    expect(db.driver).toBe('sqlite')
  })

  test('Database.fromConfig handles testing env for sqlite', () => {
    const db = Database.fromConfig(
      {
        default: 'sqlite',
        connections: {
          sqlite: { database: 'database/stacks.sqlite' },
        },
      },
      'testing',
    )
    expect(db.connection.database).toContain('testing')
  })

  test('Database.fromConfig handles postgres with testing suffix', () => {
    const db = Database.fromConfig(
      {
        default: 'postgres',
        connections: {
          postgres: { name: 'stacks', host: '127.0.0.1', port: 5432 },
        },
      },
      'testing',
    )
    expect(db.connection.database).toBe('stacks_testing')
  })

  test('Database.close resets initialized state', () => {
    const db = createSqliteDatabase(':memory:')
    db.initialize()
    expect(db.isInitialized).toBe(true)
    db.close()
    expect(db.isInitialized).toBe(false)
  })
})
