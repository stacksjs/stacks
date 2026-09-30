/**
 * Framework model renames reach apps that upgrade across them.
 *
 * The Driver -> Courier rename (stacksjs/stacks#2382) was caught up in this
 * repository by regenerating its own snapshot and running a sqlite3 script in
 * its own deploy `preStart`. Apps got neither. Their snapshot still described
 * `drivers`, so `buddy migrate` proposed dropping it - on a fresh database too,
 * because the differ reads the snapshot, not the database - and refused to do
 * that unattended. Every upgraded app's CI and deploy stopped there.
 *
 * These cover both halves of the catch-up: the snapshot rewrite the differ
 * reads, and the database rename that keeps the rows.
 */

import type { MigrationPlan } from '@stacksjs/query-builder'
import type { FrameworkRename, RenameSqlRunner } from '../src/framework-renames'
import { Database } from 'bun:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import {
  applicableFrameworkRenames,
  applyFrameworkRenamesToDatabase,
  applyFrameworkRenamesToPlan,
  FRAMEWORK_RENAMES,
  FrameworkRenameConflictError,
  renameIdentifierPart,
  replaceIndexName,
  sqliteLiteralIndexColumns,
} from '../src/framework-renames'

const COMMITTED_SNAPSHOT = join(import.meta.dir, '../../../database/model-snapshot.sqlite.json')

function committedPlan(): MigrationPlan {
  return JSON.parse(readFileSync(COMMITTED_SNAPSHOT, 'utf8')).plan as MigrationPlan
}

/** The registry run backwards, to turn the current snapshot into a pre-rename one. */
function reversed(renames: readonly FrameworkRename[]): FrameworkRename[] {
  return renames.map(group => ({
    ...group,
    tables: group.tables.map(({ from, to }) => ({ from: to, to: from })),
    columns: [],
  }))
}

/** A snapshot as an app that last migrated before the rename holds it. */
function stalePlan(): MigrationPlan {
  const plan = structuredClone(committedPlan())
  for (const group of FRAMEWORK_RENAMES) {
    for (const { table, from, to } of group.columns) {
      const entry = plan.tables.find(t => t.table === table)
      const column = entry?.columns.find(c => c.name === to)
      if (column)
        column.name = from
    }
  }
  return applyFrameworkRenamesToPlan(plan, reversed(FRAMEWORK_RENAMES)).plan
}

function runnerFor(db: Database): RenameSqlRunner {
  return async (sql: string) => db.query(sql).all()
}

function tables(db: Database): string[] {
  return (db.query(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all() as Array<{ name: string }>).map(r => r.name)
}

function columns(db: Database, table: string): string[] {
  return (db.query(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>).map(r => r.name)
}

function tableSql(db: Database, table: string): string {
  return (db.query(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`).get(table) as { sql: string }).sql
}

function count(db: Database, table: string): number {
  return (db.query(`SELECT COUNT(*) AS n FROM "${table}"`).get() as { n: number }).n
}

/** The schema the pre-rename corpus built, with rows in it. */
function preRenameDatabase(options: { rows?: boolean } = {}): Database {
  const db = new Database(':memory:')
  db.run('PRAGMA foreign_keys = ON')
  db.run(`CREATE TABLE "drivers" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT, "vehicle_number" TEXT, "uuid" TEXT)`)
  db.run(`CREATE UNIQUE INDEX "drivers_uuid_unique" ON "drivers" ("uuid")`)
  db.run(`CREATE TABLE "delivery_routes" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "driver" TEXT, "vehicle" TEXT, "driver_id" INTEGER REFERENCES "drivers"("id"))`)
  db.run(`CREATE TABLE "driver_pings" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "latitude" INTEGER NOT NULL, "driver_id" INTEGER REFERENCES "drivers"("id"), "delivery_route_id" INTEGER REFERENCES "delivery_routes"("id"), "uuid" TEXT)`)
  db.run(`CREATE UNIQUE INDEX "driver_pings_uuid_unique" ON "driver_pings" ("uuid")`)

  if (options.rows !== false) {
    db.run(`INSERT INTO drivers (id, name, vehicle_number, uuid) VALUES (1, 'Jane', 'VAN-1', 'a'), (2, 'Sam', 'VAN-2', 'b')`)
    db.run(`INSERT INTO delivery_routes (id, driver, vehicle, driver_id) VALUES (1, 'Jane', 'VAN-1', 1)`)
    db.run(`INSERT INTO driver_pings (latitude, driver_id, delivery_route_id, uuid) VALUES (10, 1, 1, 'p1'), (11, 1, 1, 'p2'), (12, 2, NULL, 'p3')`)
  }
  return db
}

describe('the registry', () => {
  it('records the Driver -> Courier rename', () => {
    const courier = FRAMEWORK_RENAMES.find(group => group.id === 'driver-to-courier')!
    expect(courier.tables).toEqual([{ from: 'drivers', to: 'couriers' }, { from: 'driver_pings', to: 'courier_pings' }])
    expect(courier.columns.map(c => `${c.table}.${c.from}->${c.to}`)).toEqual([
      'courier_pings.driver_id->courier_id',
      'delivery_routes.driver->courier',
      'delivery_routes.driver_id->courier_id',
    ])
  })

  it('names no old table the current models still declare', () => {
    const declared = new Set(committedPlan().tables.map(t => t.table))
    for (const group of FRAMEWORK_RENAMES) {
      for (const { from, to } of group.tables) {
        expect(declared.has(from)).toBe(false)
        expect(declared.has(to)).toBe(true)
      }
    }
  })

  it('stands down for an app that still declares an old table itself', () => {
    expect(applicableFrameworkRenames(new Set(['users', 'couriers'])).map(g => g.id)).toContain('driver-to-courier')
    expect(applicableFrameworkRenames(new Set(['users', 'drivers'])).map(g => g.id)).not.toContain('driver-to-courier')
    expect(applicableFrameworkRenames(new Set(['DRIVER_PINGS'])).map(g => g.id)).not.toContain('driver-to-courier')
  })

  it('renames a table name only where it is a whole part of an identifier', () => {
    expect(renameIdentifierPart('drivers_uuid_unique', 'drivers', 'couriers')).toBe('couriers_uuid_unique')
    expect(renameIdentifierPart('drivers_drivers_uuid_unique', 'drivers', 'couriers')).toBe('couriers_couriers_uuid_unique')
    expect(renameIdentifierPart('subdrivers_x', 'drivers', 'couriers')).toBe('subdrivers_x')
    expect(renameIdentifierPart('driver_pings_uuid_unique', 'drivers', 'couriers')).toBe('driver_pings_uuid_unique')
  })

  it('swaps only the index name in a stored CREATE INDEX', () => {
    expect(replaceIndexName(`CREATE UNIQUE INDEX "drivers_uuid_unique" ON "couriers" ("uuid")`, 'drivers_uuid_unique', 'couriers_uuid_unique'))
      .toBe(`CREATE UNIQUE INDEX "couriers_uuid_unique" ON "couriers" ("uuid")`)
    expect(replaceIndexName('CREATE INDEX idx_a ON t (a)', 'idx_a', 'idx_b')).toBe('CREATE INDEX idx_b ON t (a)')
    expect(replaceIndexName('something else', 'idx_a', 'idx_b')).toBeUndefined()
  })

  it('finds the quoted key names SQLite would have read as string constants', () => {
    const users = ['id', 'name', 'email']
    expect(sqliteLiteralIndexColumns(`CREATE UNIQUE INDEX IF NOT EXISTS "users_users_uuid_unique" ON "users" ("uuid")`, users)).toEqual(['uuid'])
    expect(sqliteLiteralIndexColumns(`CREATE INDEX "users_email_uuid" ON "users" ("email" COLLATE NOCASE DESC, "uuid" ASC) WHERE "email" IS NOT NULL`, users)).toEqual(['uuid'])
    expect(sqliteLiteralIndexColumns(`CREATE INDEX "users_email_name_index" ON "users" ("EMAIL", "name")`, users)).toEqual([])
    // Expressions and unquoted names are not the misread shape; unquoted
    // unknown names never get into the schema at all.
    expect(sqliteLiteralIndexColumns(`CREATE INDEX "users_lower_email" ON "users" (lower("email"), 'x')`, users)).toEqual([])
    expect(sqliteLiteralIndexColumns('CREATE INDEX idx ON users (name)', users)).toEqual([])
    expect(sqliteLiteralIndexColumns('not an index', users)).toEqual([])
  })
})

describe('snapshot catch-up', () => {
  it('turns a pre-rename snapshot into exactly the current one', () => {
    const stale = stalePlan()
    expect(stale.tables.some(t => t.table === 'drivers')).toBe(true)
    expect(stale.tables.some(t => t.table === 'couriers')).toBe(false)

    const { plan, changes } = applyFrameworkRenamesToPlan(stale)
    expect(changes.length).toBeGreaterThan(0)
    expect(plan).toEqual(committedPlan())
  })

  it('changes nothing on a current snapshot, and does not mutate its input', () => {
    const current = committedPlan()
    const before = JSON.stringify(current)
    const { plan, changes } = applyFrameworkRenamesToPlan(current)
    expect(changes).toEqual([])
    expect(plan).toEqual(current)
    expect(JSON.stringify(current)).toBe(before)
  })

  it('drops a stale old entry when the snapshot already has the new one', () => {
    const plan = committedPlan()
    const stale = structuredClone(plan.tables.find(t => t.table === 'couriers')!)
    stale.table = 'drivers'
    const { plan: next } = applyFrameworkRenamesToPlan({ ...plan, tables: [...plan.tables, stale] })
    expect(next).toEqual(plan)
  })
})

describe('database catch-up (sqlite)', () => {
  it('renames a pre-rename database, keeping every row and repointing foreign keys', async () => {
    const db = preRenameDatabase()
    const { applied } = await applyFrameworkRenamesToDatabase(runnerFor(db), 'sqlite')

    expect(applied).toContain('renamed drivers -> couriers')
    expect(applied).toContain('renamed driver_pings -> courier_pings')
    expect(tables(db)).toEqual(['courier_pings', 'couriers', 'delivery_routes'])

    expect(count(db, 'couriers')).toBe(2)
    expect(count(db, 'courier_pings')).toBe(3)
    expect(columns(db, 'courier_pings')).toContain('courier_id')
    expect(columns(db, 'courier_pings')).not.toContain('driver_id')
    expect(columns(db, 'delivery_routes')).toEqual(['id', 'courier', 'vehicle', 'courier_id'])
    expect(db.query('SELECT courier, courier_id FROM delivery_routes').get()).toEqual({ courier: 'Jane', courier_id: 1 })

    // REFERENCES follow the rename, which SQLite only does with foreign keys on.
    expect(tableSql(db, 'courier_pings')).toContain('REFERENCES "couriers"')
    expect(tableSql(db, 'delivery_routes')).toContain('REFERENCES "couriers"')
    expect(tableSql(db, 'courier_pings')).not.toContain('drivers')
    expect(db.query('PRAGMA foreign_key_check').all()).toEqual([])
    db.run(`INSERT INTO courier_pings (latitude, courier_id) VALUES (1, 2)`)
    expect(() => db.run(`INSERT INTO courier_pings (latitude, courier_id) VALUES (1, 99)`)).toThrow(/FOREIGN KEY/)

    const indexes = (db.query(`SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name`).all() as Array<{ name: string }>).map(r => r.name)
    expect(indexes).toEqual(['courier_pings_uuid_unique', 'couriers_uuid_unique'])
    expect(() => db.run(`INSERT INTO couriers (name, uuid) VALUES ('dup', 'a')`)).toThrow(/UNIQUE/)
  })

  it('is idempotent: a second run applies nothing', async () => {
    const db = preRenameDatabase()
    await applyFrameworkRenamesToDatabase(runnerFor(db), 'sqlite')
    const schema = db.query(`SELECT type, name, sql FROM sqlite_master ORDER BY name`).all()

    const again = await applyFrameworkRenamesToDatabase(runnerFor(db), 'sqlite')
    expect(again).toEqual({ applied: [], skipped: [] })
    expect(db.query(`SELECT type, name, sql FROM sqlite_master ORDER BY name`).all()).toEqual(schema)
  })

  it('does nothing to a fresh database', async () => {
    const db = new Database(':memory:')
    expect(await applyFrameworkRenamesToDatabase(runnerFor(db), 'sqlite')).toEqual({ applied: [], skipped: [] })
    expect(tables(db)).toEqual([])
  })

  it('renames the empty tables an old corpus creates on a fresh database', async () => {
    const db = preRenameDatabase({ rows: false })
    await applyFrameworkRenamesToDatabase(runnerFor(db), 'sqlite')
    expect(tables(db)).toEqual(['courier_pings', 'couriers', 'delivery_routes'])
    expect(columns(db, 'delivery_routes')).toEqual(['id', 'courier', 'vehicle', 'courier_id'])
  })

  it('refuses, changing nothing, when the old and new tables both hold rows', async () => {
    const db = preRenameDatabase()
    db.run(`CREATE TABLE "couriers" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT, "vehicle_number" TEXT, "uuid" TEXT)`)
    db.run(`INSERT INTO couriers (name) VALUES ('Written through the new schema')`)
    const schema = db.query(`SELECT type, name, sql FROM sqlite_master ORDER BY name`).all()

    const attempt = applyFrameworkRenamesToDatabase(runnerFor(db), 'sqlite')
    await expect(attempt).rejects.toBeInstanceOf(FrameworkRenameConflictError)
    await expect(applyFrameworkRenamesToDatabase(runnerFor(db), 'sqlite')).rejects.toThrow(/drivers \(2 rows\) and couriers \(1 row\) both hold data/)

    expect(db.query(`SELECT type, name, sql FROM sqlite_master ORDER BY name`).all()).toEqual(schema)
    expect(count(db, 'drivers')).toBe(2)
    expect(count(db, 'couriers')).toBe(1)
    expect(count(db, 'driver_pings')).toBe(3)
  })

  it('gives the name to the table holding the rows when the other is an empty shell', async () => {
    // Old rows, empty new table: what a corpus that already creates the new
    // names leaves on a database that predates the rename.
    const shell = preRenameDatabase()
    shell.run(`CREATE TABLE "couriers" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT)`)
    shell.run(`CREATE TABLE "courier_pings" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "courier_id" INTEGER REFERENCES "couriers"("id"))`)
    await applyFrameworkRenamesToDatabase(runnerFor(shell), 'sqlite')
    expect(count(shell, 'couriers')).toBe(2)
    expect(count(shell, 'courier_pings')).toBe(3)
    expect(columns(shell, 'couriers')).toContain('vehicle_number')
    expect(shell.query('PRAGMA foreign_key_check').all()).toEqual([])

    // New rows, empty old table: the leftover is dropped.
    const leftover = preRenameDatabase({ rows: false })
    leftover.run(`CREATE TABLE "couriers" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT)`)
    leftover.run(`INSERT INTO couriers (name) VALUES ('Current')`)
    const { applied } = await applyFrameworkRenamesToDatabase(runnerFor(leftover), 'sqlite')
    expect(applied).toContain('dropped empty legacy drivers (couriers holds the rows)')
    expect(tables(leftover)).not.toContain('drivers')
    expect(count(leftover, 'couriers')).toBe(1)
  })

  // StatusHQ CI (stacksjs/status run 36730075894): its corpus creates
  // users_users_uuid_unique ON users ("uuid") while users has no uuid column,
  // and the post-batch catch-up died on `RENAME COLUMN` with "error in index
  // users_users_uuid_unique after rename: no such column: uuid".
  it('drops an index SQLite keyed on a string constant instead of failing every rename on it', async () => {
    const db = preRenameDatabase()
    db.run(`CREATE TABLE "users" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT, "email" TEXT)`)
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS "users_users_uuid_unique" ON "users" ("uuid")`)
    db.run(`CREATE INDEX "users_email_index" ON "users" ("email")`)
    db.run(`INSERT INTO users (name) VALUES ('first')`)
    // The constant key is what makes this index harmful and not merely odd.
    expect(() => db.run(`INSERT INTO users (name) VALUES ('second')`)).toThrow(/UNIQUE/)
    // And what the rename trips over, before this module handled it.
    expect(() => db.run(`ALTER TABLE "delivery_routes" RENAME COLUMN "vehicle" TO "vehicle_probe"`)).toThrow(/users_users_uuid_unique after rename: no such column: uuid/)

    const { applied } = await applyFrameworkRenamesToDatabase(runnerFor(db), 'sqlite')

    expect(applied[0]).toMatch(/^dropped index users_users_uuid_unique: users has no column uuid/)
    expect(applied).toContain('renamed drivers -> couriers')
    expect(applied).toContain('renamed delivery_routes.driver -> courier')
    expect(columns(db, 'delivery_routes')).toEqual(['id', 'courier', 'vehicle', 'courier_id'])
    const indexes = (db.query(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'users'`).all() as Array<{ name: string }>).map(r => r.name)
    expect(indexes).toEqual(['users_email_index'])
    db.run(`INSERT INTO users (name) VALUES ('second')`)
    expect(count(db, 'users')).toBe(2)
    expect(db.query('PRAGMA integrity_check').all()).toEqual([{ integrity_check: 'ok' }])

    expect(await applyFrameworkRenamesToDatabase(runnerFor(db), 'sqlite')).toEqual({ applied: [], skipped: [] })
  })

  it('leaves such an index alone on a database with nothing to rename', async () => {
    const db = new Database(':memory:')
    db.run(`CREATE TABLE "users" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT)`)
    db.run(`CREATE UNIQUE INDEX "users_users_uuid_unique" ON "users" ("uuid")`)
    expect(await applyFrameworkRenamesToDatabase(runnerFor(db), 'sqlite')).toEqual({ applied: [], skipped: [] })
    expect(db.query(`SELECT name FROM sqlite_master WHERE name = 'users_users_uuid_unique'`).get()).toEqual({ name: 'users_users_uuid_unique' })
  })
})

describe('database catch-up (mysql / postgres)', () => {
  /** Enough of a catalog to answer the reads, recording every other statement. */
  function fakeCatalog(dialect: 'mysql' | 'postgres', schema: Record<string, { columns: string[], rows: number }>) {
    const statements: string[] = []
    const runner: RenameSqlRunner = async (sql) => {
      const literal = [...sql.matchAll(/'([^']*)'/g)].map(m => m[1]!)
      if (/information_schema\.(TABLES|tables)/.test(sql))
        return [{ n: schema[literal.at(-1)!] ? 1 : 0 }]
      if (/information_schema\.(COLUMNS|columns)/.test(sql))
        return [{ n: schema[literal.at(-2)!]?.columns.includes(literal.at(-1)!) ? 1 : 0 }]
      const counted = sql.match(/^SELECT COUNT\(\*\) AS n FROM [`"](\w+)[`"]$/)
      if (counted)
        return [{ n: schema[counted[1]!]?.rows ?? 0 }]
      statements.push(sql)
      return []
    }
    return { runner, statements, dialect }
  }

  it('renames with the dialect\'s own quoting when only the old names exist', async () => {
    const schema = {
      drivers: { columns: ['id'], rows: 2 },
      driver_pings: { columns: ['id', 'driver_id'], rows: 0 },
      delivery_routes: { columns: ['id', 'driver', 'driver_id'], rows: 1 },
    }
    const mysql = fakeCatalog('mysql', schema)
    await applyFrameworkRenamesToDatabase(mysql.runner, 'mysql')
    expect(mysql.statements).toEqual([
      'ALTER TABLE `drivers` RENAME TO `couriers`',
      'ALTER TABLE `driver_pings` RENAME TO `courier_pings`',
      // The fake does not rename; only delivery_routes is still visible under its name.
      'ALTER TABLE `delivery_routes` RENAME COLUMN `driver` TO `courier`',
      'ALTER TABLE `delivery_routes` RENAME COLUMN `driver_id` TO `courier_id`',
    ])

    const postgres = fakeCatalog('postgres', schema)
    await applyFrameworkRenamesToDatabase(postgres.runner, 'postgres')
    expect(postgres.statements[0]).toBe('ALTER TABLE "drivers" RENAME TO "couriers"')
    expect(postgres.statements.some(s => s.startsWith('PRAGMA'))).toBe(false)
  })

  it('skips, with a message and no drop, when both tables exist', async () => {
    const postgres = fakeCatalog('postgres', {
      drivers: { columns: ['id'], rows: 2 },
      couriers: { columns: ['id'], rows: 0 },
    })
    const { applied, skipped } = await applyFrameworkRenamesToDatabase(postgres.runner, 'postgres')
    expect(applied).toEqual([])
    expect(skipped[0]).toContain('drivers and couriers both exist')
    expect(postgres.statements).toEqual([])
  })
})

describe('buddy migrate against a snapshot that predates the rename', () => {
  const ORIGINAL = process.env.DB_SNAPSHOT_PATH
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'stale-snapshot-'))
    writeFileSync(join(dir, 'model-snapshot.sqlite.json'), JSON.stringify({ plan: stalePlan(), dialect: 'sqlite' }, null, 2))
    process.env.DB_SNAPSHOT_PATH = dir
  })

  afterEach(() => {
    if (ORIGINAL === undefined)
      delete process.env.DB_SNAPSHOT_PATH
    else
      process.env.DB_SNAPSHOT_PATH = ORIGINAL
    rmSync(dir, { recursive: true, force: true })
  })

  it('previews no change at all, and the preview writes nothing', async () => {
    const { pendingMigrationOperations } = await import('../src/migrations')
    const before = readFileSync(join(dir, 'model-snapshot.sqlite.json'), 'utf8')

    const operations = await pendingMigrationOperations({ fromDb: false, applyRenames: true })
    expect(operations.filter(op => op.destructive).map(op => `${op.kind} ${op.table}`)).toEqual([])
    expect(operations.map(op => `${op.kind} ${op.table}`)).toEqual([])

    expect(readFileSync(join(dir, 'model-snapshot.sqlite.json'), 'utf8')).toBe(before)
  }, 60_000)

  it('persists the corrected snapshot when it generates', async () => {
    const { catchUpSnapshotFrameworkRenames } = await import('../src/migrations')

    const first = catchUpSnapshotFrameworkRenames({ persist: true })
    expect(first.changes).toContain('drivers -> couriers')
    expect(existsSync(join(dir, 'model-snapshot.sqlite.json'))).toBe(true)

    const saved = JSON.parse(readFileSync(join(dir, 'model-snapshot.sqlite.json'), 'utf8')).plan as MigrationPlan
    expect(saved.tables).toEqual(committedPlan().tables)

    expect(catchUpSnapshotFrameworkRenames({ persist: true }).changes).toEqual([])
  }, 60_000)
})
