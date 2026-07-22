import { describe, expect, it } from 'bun:test'
import { USERS_GUARANTEED_COLUMNS, isManagedColumnDrop, withoutManagedColumnDropSql, withoutManagedColumnDrops } from '../src/managed-columns'

// Regression coverage for stacksjs/stacks#2075: the model-first schema differ
// proposes dropping trait-managed columns (useAuth 2FA, billable stripe_id,
// useUuid) because they aren't in `attributes`. These guards keep those drops
// out of both the destructive confirmation gate and the generated SQL.

// `users` auth/billing columns + `uuid` on a useUuid-backed table, the same
// shape frameworkManagedColumns() builds (without walking model files).
const managed = new Map<string, Set<string>>([
  ['users', new Set(USERS_GUARANTEED_COLUMNS)],
  ['products', new Set(['uuid'])],
])

const op = (kind: string, table: string, column?: string, sql = ''): any => ({ kind, table, column, destructive: true, sql })

describe('framework-managed column guards (#2075)', () => {
  it('exposes the exact users columns the guarantee-ALTERs create', () => {
    expect([...USERS_GUARANTEED_COLUMNS].sort()).toEqual([
      'email_verified_at',
      'password_changed_at',
      'stripe_id',
      'two_factor_enabled',
      'two_factor_last_used_step',
      'two_factor_secret',
    ])
  })

  it('recognizes a managed column drop but not a user column drop', () => {
    expect(isManagedColumnDrop(op('drop_column', 'users', 'two_factor_secret'), managed)).toBe(true)
    expect(isManagedColumnDrop(op('drop_column', 'users', 'stripe_id'), managed)).toBe(true)
    expect(isManagedColumnDrop(op('drop_column', 'products', 'uuid'), managed)).toBe(true)
    // A genuine user column on a managed table is still droppable.
    expect(isManagedColumnDrop(op('drop_column', 'users', 'nickname'), managed)).toBe(false)
    // uuid on a table that doesn't declare useUuid is not protected.
    expect(isManagedColumnDrop(op('drop_column', 'orders', 'uuid'), managed)).toBe(false)
    // Non-drop operations are never touched.
    expect(isManagedColumnDrop(op('add_column', 'users', 'two_factor_secret'), managed)).toBe(false)
  })

  it('strips managed drops from the operations list, keeping everything else', () => {
    const operations = [
      op('drop_column', 'users', 'two_factor_secret'),
      op('drop_column', 'users', 'email_verified_at'),
      op('drop_column', 'users', 'stripe_id'),
      op('drop_column', 'products', 'uuid'),
      op('drop_column', 'users', 'nickname'), // genuine drop — must survive
      op('add_column', 'users', 'phone'),
      op('rename_column', 'users', 'handle'),
    ]
    const kept = withoutManagedColumnDrops(operations, managed)
    expect(kept.map(o => `${o.kind}:${o.table}.${o.column}`)).toEqual([
      'drop_column:users.nickname',
      'add_column:users.phone',
      'rename_column:users.handle',
    ])
  })

  it('strips the direct ALTER TABLE ... DROP COLUMN SQL across dialect quoting', () => {
    const statements = [
      'ALTER TABLE "users" DROP COLUMN "two_factor_secret"', // postgres
      'ALTER TABLE `users` DROP COLUMN `stripe_id`', // mysql
      'ALTER TABLE users DROP COLUMN IF EXISTS two_factor_enabled', // sqlite>=3.35
      'ALTER TABLE users DROP COLUMN nickname', // genuine — keep
      'ALTER TABLE "products" DROP COLUMN "uuid"',
      'CREATE INDEX idx ON users (email)', // unrelated — keep
    ]
    const { statements: kept, removed } = withoutManagedColumnDropSql(statements, managed)
    expect(removed).toHaveLength(4)
    expect(kept).toEqual([
      'ALTER TABLE users DROP COLUMN nickname',
      'CREATE INDEX idx ON users (email)',
    ])
  })

  it('strips the SQLite table-rebuild form by matching the operation sql', () => {
    // SQLite drops a column by rebuilding the table without it; the statement
    // has no "DROP COLUMN" to regex, so it's matched via the structured op sql.
    const rebuild = 'CREATE TABLE users_new (id integer primary key, name text); INSERT INTO users_new SELECT id, name FROM users; DROP TABLE users; ALTER TABLE users_new RENAME TO users'
    const statements = [rebuild, 'ALTER TABLE users DROP COLUMN nickname']
    const operations = [op('drop_column', 'users', 'two_factor_secret', rebuild)]
    const { statements: kept, removed } = withoutManagedColumnDropSql(statements, managed, operations)
    expect(removed).toEqual([rebuild])
    expect(kept).toEqual(['ALTER TABLE users DROP COLUMN nickname'])
  })

  it('is a no-op when nothing managed is being dropped', () => {
    const statements = ['ALTER TABLE users DROP COLUMN nickname', 'ALTER TABLE users ADD COLUMN phone text']
    const { statements: kept, removed } = withoutManagedColumnDropSql(statements, managed)
    expect(removed).toEqual([])
    expect(kept).toEqual(statements)
  })
})
