import { describe, expect, it } from 'bun:test'
import { groupGeneratedStatements, inlineSqliteAddedColumnReferences } from '../src/migrations'

describe('generated migration grouping', () => {
  it('keeps references when SQLite adds a relation column incrementally', () => {
    const statements = inlineSqliteAddedColumnReferences(
      ['ALTER TABLE "delivery_routes" ADD COLUMN "driver_id" INTEGER;'],
      {
        tables: [{
          table: 'delivery_routes',
          columns: [{
            name: 'driver_id',
            references: { table: 'drivers', column: 'id' },
          }],
        }],
      },
    )

    expect(statements).toEqual([
      'ALTER TABLE "delivery_routes" ADD COLUMN "driver_id" INTEGER REFERENCES "drivers"("id");',
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
