import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { GENERATED_MIGRATION_MARKER } from '../src/generated-migration-marker'
import { findHandWrittenMigrations, handWrittenMigrationPolicy } from '../src/hand-written-migrations'

/**
 * Every migration is meant to be generated from app/Models. A file without the
 * generator's `-- qb:generated` marker is one the models do not describe, and
 * `buddy migrate --strict` / `migrate:status --strict` fail on it.
 */
describe('findHandWrittenMigrations', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hand-written-'))
    writeFileSync(join(dir, '0000000001-create-teams-table.sql'), `${GENERATED_MIGRATION_MARKER}\nCREATE TABLE "teams" ("id" BIGSERIAL PRIMARY KEY);\n`)
    // bun-query-builder's own marker, without the Stacks note under it.
    writeFileSync(join(dir, '0000000002-alter-teams-table.sql'), '-- qb:generated\nALTER TABLE "teams" ADD COLUMN "name" text;\n')
    writeFileSync(join(dir, '0000000003-add-teams-index.sql'), '-- Added by hand.\nCREATE INDEX "teams_teams_name_index" ON "teams" ("name");\n')
    writeFileSync(join(dir, '0000000004-seed-plans.sql'), 'INSERT INTO "plans" VALUES (1);\n')
    // A package's migration, staged into the reserved band: not the app's.
    writeFileSync(join(dir, '9000000001-acme-billing-create-invoices.sql'), 'CREATE TABLE "invoices" ("id" BIGSERIAL PRIMARY KEY);\n')
    writeFileSync(join(dir, 'notes.txt'), 'not a migration')
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('lists app-owned files without a generator marker', () => {
    expect(findHandWrittenMigrations(dir)).toEqual(['0000000003-add-teams-index.sql', '0000000004-seed-plans.sql'])
  })

  it('honours an allow-list by filename or logical name, and allow-all', () => {
    expect(findHandWrittenMigrations(dir, handWrittenMigrationPolicy(['seed-plans'], undefined))).toEqual(['0000000003-add-teams-index.sql'])
    expect(findHandWrittenMigrations(dir, handWrittenMigrationPolicy(['0000000003-add-teams-index.sql'], undefined))).toEqual(['0000000004-seed-plans.sql'])
    expect(findHandWrittenMigrations(dir, handWrittenMigrationPolicy(true, undefined))).toEqual([])
  })

  it('lets the env var override the config either way', () => {
    expect(handWrittenMigrationPolicy(undefined, '1').allowAll).toBe(true)
    expect(handWrittenMigrationPolicy(true, 'false').allowAll).toBe(true)
    expect([...handWrittenMigrationPolicy(undefined, 'seed-plans, other').allowed]).toEqual(['seed-plans', 'other'])
    expect(handWrittenMigrationPolicy(['x'], '').allowed.has('x')).toBe(true)
  })

  it('reads a missing directory as nothing to report', () => {
    expect(findHandWrittenMigrations(join(dir, 'nope'))).toEqual([])
  })
})
