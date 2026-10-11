/**
 * `migrate:regenerate --replace-unmarked` kept files a regenerated corpus does
 * replace, reporting them as "describe tables this corpus does not rebuild":
 * a file naming no table was read as "cannot prove it is ours". Rehearsed on a
 * real app's production schema, three kinds came up:
 *
 *   - an old types-only file (`DO $stacks$ BEGIN CREATE TYPE ... END $stacks$`
 *     plus `ALTER TYPE ... ADD VALUE`) for types the regenerated corpus
 *     declares itself;
 *   - a file whose only statement drops an index nothing builds;
 *   - a data fix (`DELETE FROM "password_resets"`), a no-op on the database
 *     the regenerated corpus builds.
 *
 * Reference data is the opposite case and is never removed.
 */

import { describe, expect, it } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describeMigrationContent, enumTypesCreatedBy, obsoleteMigrationReason } from '../src/migrations'

const none = { emittedTypes: new Set<string>(), keptIndexes: new Set<string>(), keptSeedTables: new Set<string>() }

describe('describeMigrationContent', () => {
  it('reads a guarded enum type file as types only', () => {
    const content = describeMigrationContent(`-- types
DO $stacks$ BEGIN CREATE TYPE "subscribers_status_type" AS ENUM ('subscribed', 'unsubscribed'); EXCEPTION WHEN duplicate_object THEN null; END $stacks$;
ALTER TYPE "subscribers_status_type" ADD VALUE IF NOT EXISTS 'bounced';
ALTER TYPE "orders_state_type" ADD VALUE IF NOT EXISTS 'paid';`)

    expect(content.types).toEqual(['subscribers_status_type', 'orders_state_type'])
    expect(content.other).toBe(false)
  })

  it('reads a bare index drop, a data fix and reference data', () => {
    expect(describeMigrationContent('DROP INDEX IF EXISTS "notification_deliveries_idempotency_key_unique";').droppedIndexes)
      .toEqual(['notification_deliveries_idempotency_key_unique'])

    const data = describeMigrationContent('-- Tokens were stored in plain text.\nDELETE FROM "password_resets";\nUPDATE "users" SET "remember_token" = NULL;')
    expect(data.dataTables).toEqual(['password_resets', 'users'])
    expect(data.other).toBe(false)

    expect(describeMigrationContent(`INSERT INTO "plans" ("name") VALUES ('Basic');`).seedTables).toEqual(['plans'])
    expect(describeMigrationContent(`COPY "plans" ("name") FROM STDIN;`).seedTables).toEqual(['plans'])
  })

  it('does not take a table rebuild\'s INSERT ... SELECT for reference data', () => {
    const content = describeMigrationContent('INSERT INTO "_qb_tmp_posts" ("id", "title") SELECT "id", "title" FROM "posts";')

    expect(content.seedTables).toEqual([])
    expect(content.other).toBe(true)
  })

  it('marks anything with table DDL as other', () => {
    const content = describeMigrationContent('CREATE TABLE "plans" ("id" BIGSERIAL PRIMARY KEY);\nCREATE INDEX "plans_name_index" ON "plans" ("name");')

    expect(content.other).toBe(true)
    expect(content.createdTables).toEqual(['plans'])
    expect(content.createdIndexes).toEqual(['plans_name_index'])
  })
})

describe('obsoleteMigrationReason', () => {
  it('replaces a types file only when the corpus declares every type in it', () => {
    const content = describeMigrationContent(`DO $$ BEGIN CREATE TYPE "a_type" AS ENUM ('x'); EXCEPTION WHEN duplicate_object THEN null; END $$;\nALTER TYPE "b_type" ADD VALUE IF NOT EXISTS 'y';`)

    expect(obsoleteMigrationReason(content, { ...none, emittedTypes: new Set(['a_type', 'b_type']) })).toBe('types')
    expect(obsoleteMigrationReason(content, { ...none, emittedTypes: new Set(['a_type']) })).toBeUndefined()
  })

  it('replaces an index drop unless a surviving file builds that index', () => {
    const content = describeMigrationContent('DROP INDEX IF EXISTS "legacy_unique";')

    expect(obsoleteMigrationReason(content, none)).toBe('drop-index')
    expect(obsoleteMigrationReason(content, { ...none, keptIndexes: new Set(['legacy_unique']) })).toBeUndefined()
  })

  it('replaces a data fix unless a surviving file filled that table before it', () => {
    const content = describeMigrationContent('DELETE FROM "password_resets";')

    expect(obsoleteMigrationReason(content, none)).toBe('data')
    expect(obsoleteMigrationReason(content, { ...none, keptSeedTables: new Set(['password_resets']) })).toBeUndefined()
  })

  it('never replaces reference data or a file mixing kinds', () => {
    expect(obsoleteMigrationReason(describeMigrationContent(`INSERT INTO "plans" VALUES (1, 'Basic');`), none)).toBeUndefined()
    expect(obsoleteMigrationReason(describeMigrationContent('DELETE FROM "plans";\nDROP INDEX "x";'), none)).toBeUndefined()
    expect(obsoleteMigrationReason(describeMigrationContent('ALTER TABLE "plans" ADD COLUMN "x" text;'), none)).toBeUndefined()
  })
})

describe('enumTypesCreatedBy', () => {
  it('finds types declared plainly and inside a guard', () => {
    const types = enumTypesCreatedBy([
      `CREATE TYPE "teams_status_type" AS ENUM ('active', 'paused')`,
      `DO $stacks$ BEGIN CREATE TYPE "posts_state_type" AS ENUM ('draft'); EXCEPTION WHEN duplicate_object THEN null; END $stacks$`,
    ])

    expect([...types].sort()).toEqual(['posts_state_type', 'teams_status_type'])
  })
})

describe('regenerateMigrationCorpus classification', () => {
  it('replaces obsolete history, keeps and relocates reference data, and leaves the default mode alone', async () => {
    const root = await mkdtemp(join(tmpdir(), 'stacks-regenerate-obsolete-'))
    try {
      await writeFile(join(root, 'bunfig.toml'), 'preload = []\n')
      const child = Bun.spawn([process.execPath, `--config=${join(root, 'bunfig.toml')}`, '--no-env-file', `${import.meta.dir}/fixtures/regenerate-obsolete-history.ts`], {
        cwd: root,
        env: { ...process.env, APP_ENV: 'test', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(root, 'app.sqlite') },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect(code, `${stdout}\n${stderr}`).toBe(0)
      const line = stdout.trim().split('\n').reverse().find(candidate => candidate.startsWith('{'))
      const { replace, keep } = JSON.parse(line!)

      expect(replace.removedObsolete).toEqual(['0000000002-create-database-types.sql', '0000000005-drop-legacy-index.sql'])
      expect(replace.removedDataOnly).toEqual(['0000000006-clear-plaintext-password-resets.sql'])
      expect(replace.preservedData).toEqual(['0000000004-seed-teams.sql', '0000000007-create-plans-table.sql'])
      // Fills a table the corpus now creates, so it moves after it.
      expect(replace.relocated).toEqual([{ from: '0000000004-seed-teams.sql', to: '0000000011-seed-teams.sql' }])
      // Creates its own table, so it stays put and roots that table.
      expect(replace.preserved).toContain('0000000007-create-plans-table.sql')
      // A DROP INDEX for an index a kept file builds is not history.
      expect(replace.preserved).toContain('0000000008-drop-plans-index.sql')
      expect(replace.preservedOutOfScope).toEqual(['0000000008-drop-plans-index.sql'])
      expect(replace.removed).not.toContain('0000000004-seed-teams.sql')

      // Without --replace-unmarked, unmarked files stay whatever they contain.
      expect(keep.removed).toEqual([])
      expect(keep.removedDataOnly).toEqual([])
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  }, 30_000)
})
