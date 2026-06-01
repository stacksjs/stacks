import { describe, expect, test } from 'bun:test'
import { generateIndexCreationSQL as sqliteIndexSQL } from '../src/drivers/sqlite'
import { generateIndexCreationSQL as mysqlIndexSQL } from '../src/drivers/mysql'
import { generateIndexCreationSQL as postgresIndexSQL } from '../src/drivers/postgres'

/**
 * Partial / multi-column unique index codegen (stacksjs/stacks#1943).
 *
 * The helper has two paths:
 *   - simple index → existing kysely chain (back-compat)
 *   - unique OR partial (where) → raw `db.unsafe(\`CREATE … INDEX …\`)`,
 *     so generated migrations don't need to import kysely's `sql`
 *     template tag just to express a WHERE clause.
 */

describe('simple indexes — back-compat kysely chain', () => {
  for (const [name, fn] of [['sqlite', sqliteIndexSQL], ['mysql', mysqlIndexSQL], ['postgres', postgresIndexSQL]] as const) {
    test(`${name}: simple index → schema.createIndex chain`, () => {
      const ddl = fn('users', { name: 'idx_users_email', columns: ['email'] })
      expect(ddl).toContain(`schema.createIndex('idx_users_email')`)
      expect(ddl).toContain(`.on('users')`)
      expect(ddl).not.toContain('CREATE UNIQUE INDEX')
      expect(ddl).not.toContain('WHERE')
    })
  }
})

describe('UNIQUE indexes (stacksjs/stacks#1943)', () => {
  test('sqlite: unique → raw CREATE UNIQUE INDEX', () => {
    const ddl = sqliteIndexSQL('users', { name: 'idx_users_email_unique', columns: ['email'], unique: true })
    expect(ddl).toContain('CREATE UNIQUE INDEX IF NOT EXISTS')
    expect(ddl).toContain('"users"')
    expect(ddl).toContain('(email)')
  })

  test('mysql: unique → backtick-quoted CREATE UNIQUE INDEX', () => {
    const ddl = mysqlIndexSQL('users', { name: 'idx_users_email_unique', columns: ['email'], unique: true })
    expect(ddl).toContain('CREATE UNIQUE INDEX IF NOT EXISTS')
    expect(ddl).toContain('\\`users\\`')
  })

  test('postgres: unique → double-quoted CREATE UNIQUE INDEX', () => {
    const ddl = postgresIndexSQL('users', { name: 'idx_users_email_unique', columns: ['email'], unique: true })
    expect(ddl).toContain('CREATE UNIQUE INDEX IF NOT EXISTS')
    expect(ddl).toContain('"users"')
  })

  test('multi-column unique', () => {
    const ddl = sqliteIndexSQL('review_flags', {
      name: 'review_flags_review_user_unique',
      columns: ['judge_review_id', 'user_id'],
      unique: true,
    })
    expect(ddl).toContain('(judge_review_id, user_id)')
  })
})

describe('partial indexes — WHERE clause (the canonical case)', () => {
  test('partial unique with WHERE — bench-review example', () => {
    const ddl = sqliteIndexSQL('review_flags', {
      name: 'review_flags_review_user_unique',
      columns: ['judge_review_id', 'user_id'],
      unique: true,
      where: 'user_id IS NOT NULL',
    })
    expect(ddl).toContain('CREATE UNIQUE INDEX')
    expect(ddl).toContain('(judge_review_id, user_id)')
    expect(ddl).toContain('WHERE user_id IS NOT NULL')
  })

  test('non-unique partial (just WHERE) still routes through raw SQL path', () => {
    const ddl = sqliteIndexSQL('posts', {
      name: 'idx_active_posts',
      columns: ['user_id'],
      where: 'deleted_at IS NULL',
    })
    expect(ddl).toContain('CREATE INDEX IF NOT EXISTS')
    expect(ddl).not.toContain('UNIQUE')
    expect(ddl).toContain('WHERE deleted_at IS NULL')
  })

  test('WHERE expression is emitted verbatim (no auto-escape — caller owns safety)', () => {
    const ddl = postgresIndexSQL('events', {
      name: 'idx_recent_events',
      columns: ['user_id'],
      where: 'created_at > NOW() - INTERVAL \'30 days\'',
    })
    expect(ddl).toContain(`WHERE created_at > NOW() - INTERVAL '30 days'`)
  })
})
