import { describe, expect, it } from 'bun:test'
import { USERS_GUARANTEED_COLUMNS, isManagedColumnDrop, withoutManagedColumnDropSql, withoutManagedColumnDrops } from '../src/managed-columns'
import { belongsToColumn, belongsToColumnsOf } from '../src/relation-columns'

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

// A `belongsTo` puts a foreign key on the declaring model's table without
// declaring it in `attributes`, so the attributes-only differ reads it as a
// stray and proposes dropping it — on every run, against the column that says
// who owns the row.
describe('relation-derived foreign keys', () => {
  it('derives the column a belongsTo entry puts on the table', () => {
    expect(belongsToColumn('User')).toBe('user_id')
    expect(belongsToColumn('PaymentMethod')).toBe('payment_method_id')
    expect(belongsToColumn({ model: 'User' })).toBe('user_id')
    // An explicit key wins, because that is the column the ORM will write.
    expect(belongsToColumn({ model: 'User', foreignKey: 'owner_id' })).toBe('owner_id')
    expect(belongsToColumn('')).toBeNull()
    expect(belongsToColumn(undefined)).toBeNull()
    expect(belongsToColumn({})).toBeNull()
  })

  it('reads every form a model can declare', () => {
    expect(belongsToColumnsOf({ name: 'Farm', belongsTo: ['User'] } as any)).toEqual(['user_id'])
    expect(belongsToColumnsOf({ name: 'Mission', belongsTo: ['Farm', 'Field', 'Drone'] } as any))
      .toEqual(['farm_id', 'field_id', 'drone_id'])
    expect(belongsToColumnsOf({ name: 'Post', belongsTo: [{ model: 'Author', foreignKey: 'writer_id' }] } as any))
      .toEqual(['writer_id'])
    expect(belongsToColumnsOf({ name: 'Standalone' } as any)).toEqual([])
  })

  it('keeps a relation key out of the destructive diff, rebuild included', () => {
    // What `buddy migrate` actually produced against a Farm model declaring
    // `belongsTo: ['User']`: one rebuild statement, surfaced as two ops.
    const rebuild = 'CREATE TABLE "_qb_tmp_farms" ("id" INTEGER PRIMARY KEY); INSERT INTO "_qb_tmp_farms" SELECT "id" FROM "farms"; DROP TABLE "farms"; ALTER TABLE "_qb_tmp_farms" RENAME TO "farms"'
    const withRelations = new Map([['farms', new Set(['user_id'])]])

    const kept = withoutManagedColumnDrops([
      op('rebuild_table', 'farms', undefined, rebuild),
      op('drop_column', 'farms', 'user_id', rebuild),
      op('rebuild_table', 'fields', undefined, 'CREATE TABLE "_qb_tmp_fields" ("id" INTEGER PRIMARY KEY)'),
    ], withRelations)

    // Both halves of the drop are gone; an unrelated rebuild is untouched.
    expect(kept.map(o => `${o.kind}:${o.table}`)).toEqual(['rebuild_table:fields'])
  })

  it('leaves a rebuild alone when it is not carrying out a suppressed drop', () => {
    const kept = withoutManagedColumnDrops([
      op('rebuild_table', 'users', undefined, 'CREATE TABLE "_qb_tmp_users" ("id" INTEGER PRIMARY KEY)'),
      op('drop_column', 'users', 'nickname', 'ALTER TABLE users DROP COLUMN nickname'),
    ], managed)

    expect(kept.map(o => `${o.kind}:${o.table}`)).toEqual(['rebuild_table:users', 'drop_column:users'])
  })

  it('does not pair operations that merely have no sql', () => {
    // Two ops with empty sql must not be treated as the same statement.
    const kept = withoutManagedColumnDrops([
      op('drop_column', 'products', 'uuid'),
      op('rebuild_table', 'orders'),
    ], managed)

    expect(kept.map(o => `${o.kind}:${o.table}`)).toEqual(['rebuild_table:orders'])
  })
})
