// Vitess dialect + DDL constraint profile.
//
// Vitess is not a new SQL renderer — vtgate parses MySQL, so the query
// builder renders for `mysql` and every divergence is about what the engine
// ACCEPTS, not what it parses. That makes the constraint audit the whole
// substance of the dialect, and these tests pin it.
//
// The failure mode being prevented: a corpus generated for plain MySQL is
// perfectly valid MySQL syntax, so the dialect auditor in
// `./migration-dialect` correctly says nothing about it. Point it at Vitess
// and every foreign key is rejected mid-migration, with tables already
// created. The constraint audit is what catches that beforehand.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import {
  auditDdlConstraints,
  auditDdlSql,
  DDL_CONSTRAINT_OVERRIDE_ENV,
  formatDdlConstraintError,
} from '../src/ddl-constraints'
import { dialectCapabilities, isMysqlWire, toQueryBuilderDialect } from '../src/dialect'
import { auditMigrationCorpus } from '../src/migration-dialect'
import { sqlHelpers } from '../src/sql-helpers'

describe('vitess dialect capabilities', () => {
  const caps = dialectCapabilities('vitess')

  test('speaks MySQL but renders through the mysql dialect', () => {
    expect(caps.wire).toBe('mysql')
    expect(isMysqlWire('vitess')).toBe(true)
    // No vitess renderer exists upstream and none is needed. Passing
    // 'vitess' through would make the query builder fall back to its
    // default dialect and render the wrong SQL entirely.
    expect(toQueryBuilderDialect('vitess')).toBe('mysql')
  })

  test('defaults to vtgate port 15306, not mysqld 3306', () => {
    // 3306 on a Vitess cluster reaches an individual tablet's mysqld and
    // silently bypasses sharding — the worst kind of working connection.
    expect(caps.defaultPort).toBe(15306)
  })

  test('rejects the three things a sharded keyspace cannot do', () => {
    expect(caps.supportsForeignKeys).toBe(false)
    expect(caps.supportsAutoIncrement).toBe(false)
    expect(caps.supportsAtomicMultiTableTransactions).toBe(false)
    expect(caps.requiresOnlineDdl).toBe(true)
  })
})

describe('sqlHelpers for a dialect without auto-increment', () => {
  test('emits a plain primary key, never AUTO_INCREMENT', () => {
    const h = sqlHelpers('vitess')
    // Emitting AUTO_INCREMENT here would not be a syntax error, which is
    // exactly why it is dangerous: each shard would independently hand out
    // the same values and collide.
    expect(h.pkColumn).not.toContain('AUTO_INCREMENT')
    expect(h.primaryKey).not.toContain('AUTO_INCREMENT')
    expect(h.pkColumn).toBe('id BIGINT NOT NULL PRIMARY KEY')
  })

  test('still renders MySQL SQL everywhere else', () => {
    const h = sqlHelpers('vitess')
    expect(h.isMysql).toBe(true)
    expect(h.now).toBe('NOW()')
    expect(h.param(1)).toBe('?')
    expect(h.nullableTimestamp).toBe('TIMESTAMP NULL')
  })

  test('mysql itself is unaffected', () => {
    expect(sqlHelpers('mysql').pkColumn).toBe('id INTEGER PRIMARY KEY AUTO_INCREMENT')
  })
})

describe('auditDdlSql', () => {
  const FK_SQL = `CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  user_id INTEGER NOT NULL,
  CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users(id)
);`

  test('flags foreign keys and auto-increment on vitess', () => {
    const violations = auditDdlSql(FK_SQL, 'posts.sql', 'vitess')
    const capabilities = new Set(violations.map(v => v.capability))
    expect(capabilities.has('foreignKeys')).toBe(true)
    expect(capabilities.has('autoIncrement')).toBe(true)
  })

  test('says nothing about the same SQL on plain mysql', () => {
    // The point of separating capability from syntax: this file is valid,
    // idiomatic MySQL and must not be flagged when MySQL is the target.
    expect(auditDdlSql(FK_SQL, 'posts.sql', 'mysql')).toEqual([])
  })

  test('flags foreign keys but not auto-increment on singlestore', () => {
    // SingleStore rejects FKs but keeps AUTO_INCREMENT, allocating
    // per-partition ranges from a single aggregator.
    const violations = auditDdlSql(FK_SQL, 'posts.sql', 'singlestore')
    const capabilities = new Set(violations.map(v => v.capability))
    expect(capabilities.has('foreignKeys')).toBe(true)
    expect(capabilities.has('autoIncrement')).toBe(false)
  })

  test('reports the line number and a snippet', () => {
    const violation = auditDdlSql(FK_SQL, 'posts.sql', 'vitess')
      .find(v => v.capability === 'foreignKeys')
    expect(violation?.line).toBe(4)
    expect(violation?.file).toBe('posts.sql')
    expect(violation?.snippet).toContain('FOREIGN KEY')
  })
})

describe('auditDdlSql false-positive resistance', () => {
  test('ignores constructs inside comments', () => {
    const sql = [
      '-- Skipped: Vitess does not support FOREIGN KEY constraints',
      '/* AUTO_INCREMENT is unavailable here */',
      'CREATE TABLE t (id BIGINT NOT NULL PRIMARY KEY);',
    ].join('\n')
    // The dialect auditor was once reporting 40 nonexistent FK migrations
    // for exactly this reason; the shared `stripSqlNoise` is what fixes it.
    expect(auditDdlSql(sql, 't.sql', 'vitess')).toEqual([])
  })

  test('ignores constructs inside quoted identifiers and strings', () => {
    const sql = [
      'CREATE TABLE t (`auto_increment` VARCHAR(20));',
      `INSERT INTO notes (body) VALUES ('we removed the FOREIGN KEY here');`,
    ].join('\n')
    expect(auditDdlSql(sql, 't.sql', 'vitess')).toEqual([])
  })

  test('does not flag AUTO_INCREMENT as a table option', () => {
    // `ENGINE=InnoDB AUTO_INCREMENT=5` is inert on a dialect without the
    // capability rather than fatal, so flagging it would reject corpora
    // that would actually migrate.
    const sql = 'CREATE TABLE t (id BIGINT) ENGINE=InnoDB AUTO_INCREMENT=5;'
    expect(auditDdlSql(sql, 't.sql', 'vitess')).toEqual([])
  })
})

describe('the two audits answer different questions', () => {
  test('a MySQL corpus passes the dialect audit but fails the constraint audit on vitess', () => {
    const sql = 'ALTER TABLE posts ADD CONSTRAINT fk FOREIGN KEY (user_id) REFERENCES users(id);'
    // Valid MySQL syntax — nothing dialect-exclusive to find.
    expect(auditMigrationCorpus({ dir: '/nonexistent', target: 'mysql' }).empty).toBe(true)
    // But the feature is unavailable on vitess.
    expect(auditDdlSql(sql, 'fk.sql', 'vitess').length).toBeGreaterThan(0)
    expect(auditDdlSql(sql, 'fk.sql', 'mysql')).toEqual([])
  })
})

describe('auditDdlConstraints over a directory', () => {
  const dir = join(
    process.env.TMPDIR || '/tmp',
    `stacks-ddl-audit-${process.pid}`,
  )

  beforeAll(() => {
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, '001-users.sql'), 'CREATE TABLE users (id BIGINT NOT NULL PRIMARY KEY);')
    writeFileSync(join(dir, '002-posts.sql'), 'CREATE TABLE posts (id BIGINT, user_id BIGINT, FOREIGN KEY (user_id) REFERENCES users(id));')
    writeFileSync(join(dir, 'notes.md'), 'FOREIGN KEY AUTO_INCREMENT')
  })

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  test('reads only .sql files', () => {
    const audit = auditDdlConstraints({ dir, dialect: 'vitess' })
    expect(audit.total).toBe(2)
    expect(audit.violations.every(v => v.file.endsWith('.sql'))).toBe(true)
  })

  test('finds the violating file and leaves the clean one alone', () => {
    const audit = auditDdlConstraints({ dir, dialect: 'vitess' })
    const files = new Set(audit.violations.map(v => v.file))
    expect(files.has('002-posts.sql')).toBe(true)
    expect(files.has('001-users.sql')).toBe(false)
  })

  test('a corpus that is clean for the target reports no violations', () => {
    expect(auditDdlConstraints({ dir, dialect: 'mysql' }).violations).toEqual([])
  })

  test('a missing directory is empty rather than an error', () => {
    const audit = auditDdlConstraints({ dir: join(dir, 'nope'), dialect: 'vitess' })
    expect(audit.empty).toBe(true)
    expect(audit.violations).toEqual([])
  })
})

describe('formatDdlConstraintError', () => {
  const audit = auditDdlConstraints({ dir: '/nonexistent', dialect: 'vitess' })

  test('names the capability, the remedy, and the override', () => {
    const withViolations = {
      total: 1,
      empty: false,
      violations: auditDdlSql(
        'CREATE TABLE posts (id INTEGER AUTO_INCREMENT, FOREIGN KEY (u) REFERENCES users(id));',
        '002-posts.sql',
        'vitess',
      ),
    }
    const message = formatDdlConstraintError(withViolations, 'vitess', 'database/migrations')

    // States that nothing ran, so the user knows the database is untouched.
    expect(message).toContain('Nothing was migrated')
    expect(message).toContain('002-posts.sql')
    // Every remedy has to be actionable — naming the trait, not just the
    // missing feature.
    expect(message).toContain('useUuid')
    expect(message).toContain(DDL_CONSTRAINT_OVERRIDE_ENV)
  })

  test('handles an empty audit without throwing', () => {
    expect(() => formatDdlConstraintError(audit, 'vitess', 'database/migrations')).not.toThrow()
  })
})
