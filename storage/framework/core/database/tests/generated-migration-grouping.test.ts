import { describe, expect, it } from 'bun:test'
import { groupGeneratedStatements, inlineSqliteAddedColumnReferences, withTableDropsLast } from '../src/migrations'

describe('generated migration grouping', () => {
  it('keeps references when SQLite adds a relation column incrementally', () => {
    const statements = inlineSqliteAddedColumnReferences(
      ['ALTER TABLE "delivery_routes" ADD COLUMN "courier_id" INTEGER;'],
      {
        tables: [{
          table: 'delivery_routes',
          columns: [{
            name: 'courier_id',
            references: { table: 'couriers', column: 'id' },
          }],
        }],
      },
    )

    expect(statements).toEqual([
      'ALTER TABLE "delivery_routes" ADD COLUMN "courier_id" INTEGER REFERENCES "couriers"("id");',
    ])
  })

  it('writes PostgreSQL enum types before tables that consume them', () => {
    const groups = groupGeneratedStatements([
      'CREATE TABLE IF NOT EXISTS "subscribers" ("id" BIGSERIAL PRIMARY KEY, "status" "subscribers_status_type" NOT NULL);',
      'CREATE TYPE "subscribers_status_type" AS ENUM (\'subscribed\', \'unsubscribed\');',
    ])

    expect(groups.map(group => group.label)).toEqual([
      'create-database-types',
      'create-subscribers-table',
    ])
  })

  it('keeps a new model table and its indexes in one create migration', () => {
    const groups = groupGeneratedStatements([
      'CREATE TABLE IF NOT EXISTS "packages" ("id" BIGSERIAL PRIMARY KEY);',
      'CREATE INDEX IF NOT EXISTS "packages_status_idx" ON "packages" ("status");',
      'CREATE UNIQUE INDEX IF NOT EXISTS "packages_code_unique" ON "packages" ("code");',
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.label).toBe('create-packages-table')
    expect(groups[0]?.statements).toHaveLength(3)
  })

  it('keeps indexes for existing tables as standalone migrations', () => {
    const groups = groupGeneratedStatements([
      'CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");',
    ])

    expect(groups[0]?.label).toBe('create-users_email_idx-index-in-users')
  })

  it('folds model foreign keys into dependency-ordered create migrations', () => {
    const groups = groupGeneratedStatements([
      'CREATE TABLE IF NOT EXISTS "memberships" ("id" BIGSERIAL PRIMARY KEY, "user_id" integer);',
      'CREATE TABLE IF NOT EXISTS "users" ("id" BIGSERIAL PRIMARY KEY);',
      'ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id");',
    ])

    expect(groups.map(group => group.label)).toEqual(['create-users-table', 'create-memberships-table'])
    expect(groups[1]?.statements[0]).toContain('CONSTRAINT "memberships_user_id_fk" FOREIGN KEY')
    expect(groups.flatMap(group => group.statements).some(statement => statement.startsWith('ALTER TABLE'))).toBe(false)
  })

  it('puts every column change to one model in ONE migration', () => {
    // Ten new attributes on a model is one edit and one schema change. It used
    // to become ten numbered migrations — `alter-fields-attr_0`,
    // `alter-fields-attr_1`, ... — that only ever ran together.
    const groups = groupGeneratedStatements(
      Array.from({ length: 10 }, (_, i) => `ALTER TABLE "fields" ADD COLUMN "attr_${i}" TEXT;`),
    )

    expect(groups).toHaveLength(1)
    expect(groups[0]?.label).toBe('alter-fields-columns')
    expect(groups[0]?.statements).toHaveLength(10)
  })

  it('keeps adds and drops on the same model together, and splits by model', () => {
    const groups = groupGeneratedStatements([
      'ALTER TABLE "fields" ADD COLUMN "soil_type" TEXT;',
      'ALTER TABLE "fields" DROP COLUMN "legacy_code";',
      'ALTER TABLE "farms" ADD COLUMN "steward" TEXT;',
    ])

    expect(groups.map(group => group.label)).toEqual(['alter-fields-columns', 'alter-farms-columns'])
    expect(groups[0]?.statements).toHaveLength(2)
    expect(groups[1]?.statements).toHaveLength(1)
  })

  it('never names a group so the query builder treats it as throwaway', () => {
    // bun-query-builder's runner treats a file matching `alter-*-table` as its
    // own regenerated output: replayed rather than recorded, then deleted from
    // disk. A generated migration named into that pattern disappears after its
    // first run, and with it the only record of the change.
    const groups = groupGeneratedStatements([
      'ALTER TABLE "fields" ADD COLUMN "soil_type" TEXT;',
      'ALTER TABLE "timetables" ADD COLUMN "slot" TEXT;',
      'ALTER TABLE "audit_table" ADD COLUMN "actor" TEXT;',
    ])

    for (const group of groups) {
      const filename = `0000000001-${group.label}.sql`
      expect(filename.includes('alter-') && filename.includes('-table')).toBe(false)
    }
  })

  it('defers only cyclic foreign keys until every new table exists', () => {
    const groups = groupGeneratedStatements([
      'CREATE TABLE "teams" ("id" BIGSERIAL PRIMARY KEY, "captain_id" integer);',
      'CREATE TABLE "users" ("id" BIGSERIAL PRIMARY KEY, "team_id" integer);',
      'ALTER TABLE "teams" ADD CONSTRAINT "teams_captain_fk" FOREIGN KEY ("captain_id") REFERENCES "users"("id");',
      'ALTER TABLE "users" ADD CONSTRAINT "users_team_fk" FOREIGN KEY ("team_id") REFERENCES "teams"("id");',
    ])

    expect(groups.map(group => group.label)).toEqual([
      'create-teams-table',
      'create-users-table',
      'create-foreign-key-constraints',
    ])
    expect(groups[2]?.statements).toHaveLength(2)
  })
})

describe('generated table drops', () => {
  // What `buddy generate:migrations` produced for an app upgrading across the
  // Driver -> Courier rename without the snapshot catch-up (rappid): the drops
  // were numbered ahead of the rebuild that takes delivery_routes' reference to
  // drivers away, so `DROP TABLE drivers` failed its implicit delete with
  // "FOREIGN KEY constraint failed" on any database where a route had a driver.
  const emitted = [
    'DROP TABLE IF EXISTS "drivers"',
    'DROP TABLE IF EXISTS "driver_pings"',
    'CREATE TABLE IF NOT EXISTS "couriers" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT)',
    'CREATE TABLE IF NOT EXISTS "courier_pings" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "courier_id" INTEGER REFERENCES "couriers"("id"))',
    'PRAGMA foreign_keys=OFF;\nBEGIN;\nCREATE TABLE "_qb_tmp_delivery_routes" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "courier_id" INTEGER REFERENCES "couriers"("id"));\nINSERT INTO "_qb_tmp_delivery_routes" ("id") SELECT "id" FROM "delivery_routes";\nDROP TABLE "delivery_routes";\nALTER TABLE "_qb_tmp_delivery_routes" RENAME TO "delivery_routes";\nCOMMIT;\nPRAGMA foreign_keys=ON',
  ]
  const previousPlan = {
    dialect: 'sqlite' as const,
    tables: [
      { table: 'drivers', columns: [{ name: 'id', type: 'bigint' as const, isPrimaryKey: true, isUnique: false, isNullable: false, hasDefault: false }], indexes: [] },
      { table: 'delivery_routes', columns: [{ name: 'driver_id', type: 'bigint' as const, isPrimaryKey: false, isUnique: false, isNullable: true, hasDefault: false, references: { table: 'drivers', column: 'id' } }], indexes: [] },
      { table: 'driver_pings', columns: [{ name: 'driver_id', type: 'bigint' as const, isPrimaryKey: false, isUnique: false, isNullable: true, hasDefault: false, references: { table: 'drivers', column: 'id' } }], indexes: [] },
    ],
  }

  it('drops tables after the rebuilds that stop referencing them, children first', () => {
    const labels = groupGeneratedStatements(emitted, previousPlan).map(group => group.label)
    expect(labels).toEqual([
      'create-couriers-table',
      'create-courier_pings-table',
      'auto-misc',
      'drop-driver_pings-table',
      'drop-drivers-table',
    ])
  })

  it('orders dependents first from the previous plan, whatever order they were emitted in', () => {
    const labels = groupGeneratedStatements([emitted[1]!, emitted[0]!], previousPlan).map(group => group.label)
    expect(labels).toEqual(['drop-driver_pings-table', 'drop-drivers-table'])
  })

  it('falls back to reverse emission order without a previous plan', () => {
    expect(groupGeneratedStatements(emitted).map(group => group.label).slice(-2))
      .toEqual(['drop-driver_pings-table', 'drop-drivers-table'])
  })

  it('leaves a drop in place when the same batch creates that table again', () => {
    const groups = [
      { label: 'drop-widgets-table', statements: ['DROP TABLE IF EXISTS "widgets"'] },
      { label: 'create-widgets-table', statements: ['CREATE TABLE IF NOT EXISTS "widgets" ("id" INTEGER PRIMARY KEY)'] },
      { label: 'alter-users-columns', statements: ['ALTER TABLE "users" ADD COLUMN "nickname" TEXT'] },
    ]
    expect(withTableDropsLast(groups)).toEqual(groups)
  })

  it('runs cleanly on a database where rows reference the dropped table', () => {
    const { Database } = require('bun:sqlite') as typeof import('bun:sqlite')
    const db = new Database(':memory:')
    db.run('PRAGMA foreign_keys = ON')
    db.run('CREATE TABLE "drivers" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT)')
    db.run('CREATE TABLE "delivery_routes" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "driver_id" INTEGER REFERENCES "drivers"("id"))')
    db.run('CREATE TABLE "driver_pings" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "driver_id" INTEGER REFERENCES "drivers"("id"))')
    db.run('INSERT INTO drivers (name) VALUES (\'Jane\')')
    db.run('INSERT INTO delivery_routes (driver_id) VALUES (1)')
    db.run('INSERT INTO driver_pings (driver_id) VALUES (1)')

    for (const group of groupGeneratedStatements(emitted, previousPlan))
      db.exec(group.statements.join(';\n'))

    const tables = (db.query(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all() as Array<{ name: string }>).map(row => row.name)
    expect(tables).toEqual(['courier_pings', 'couriers', 'delivery_routes'])
    expect(db.query('SELECT COUNT(*) AS n FROM delivery_routes').get()).toEqual({ n: 1 })
  })
})
