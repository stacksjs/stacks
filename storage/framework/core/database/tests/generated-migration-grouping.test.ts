import { describe, expect, it } from 'bun:test'
import { groupGeneratedStatements } from '../src/migrations'

describe('generated migration grouping', () => {
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
