// Migration ledger drift (stacksjs/stacks#2203).
//
// Regenerating the corpus renumbers every file. The `migrations` table keys on
// the filename, so a renumbered-but-applied migration reads as pending and
// everything after it queues behind. In the reported case the ledger claimed 6
// applied while the schema reflected ~22, and the first symptom was a 500 from
// an unrelated feature weeks later.
//
// The classifier is what makes recovery safe, so it is what these cover: the
// difference between "applied, ledger lost the row" and "genuinely never ran"
// is the entire decision, and getting it wrong in either direction is worse
// than the drift — record a migration that never ran and it is skipped forever;
// re-run one that did and an ADD CONSTRAINT (or the corpus's hard
// `DELETE FROM oauth_access_tokens`) fires a second time.

import type { LiveSchema, MigrationEffect } from '../src/migration-ledger'
import { describe, expect, it } from 'bun:test'
import {
  classifyMigration,
  effectPresent,
  logicalName,
  migrationEffects,
  planLedgerRemap,
  stripForEffects,
  verifiableEffects,
} from '../src/migration-ledger'

function schema(parts: Partial<{
  tables: string[]
  columns: Record<string, string[]>
  indexes: string[]
  constraints: string[]
  enums: string[]
}>): LiveSchema {
  return {
    tables: new Set(parts.tables ?? []),
    columns: new Map(Object.entries(parts.columns ?? {}).map(([t, c]) => [t, new Set(c)])),
    indexes: new Set(parts.indexes ?? []),
    constraints: new Set(parts.constraints ?? []),
    enums: new Set(parts.enums ?? []),
  }
}

const split = (effects: MigrationEffect[], live: LiveSchema): { present: MigrationEffect[], absent: MigrationEffect[] } => ({
  present: effects.filter(e => effectPresent(e, live)),
  absent: effects.filter(e => !effectPresent(e, live)),
})

describe('logicalName', () => {
  it('strips the ordinal prefix, which is the only thing a renumber changes', () => {
    expect(logicalName('0000000003-create-issues-table.sql')).toBe('create-issues-table')
    expect(logicalName('0000000002-create-issues-table.sql')).toBe('create-issues-table')
  })

  it('treats the two numberings of one migration as the same migration', () => {
    // Exactly the reported drift: same logical migration, different ordinal.
    expect(logicalName('0000000002-create-alert_channels-table.sql'))
      .toBe(logicalName('0000000005-create-alert_channels-table.sql'))
  })

  it('handles the timestamp-prefixed files the corpus also carries', () => {
    expect(logicalName('1785502251814-repair-seeded-image-urls.sql')).toBe('repair-seeded-image-urls')
  })

  it('leaves an unprefixed name alone', () => {
    expect(logicalName('create-users-table.sql')).toBe('create-users-table')
  })
})

describe('migrationEffects', () => {
  it('reads a CREATE TABLE, quoted or not', () => {
    expect(migrationEffects('CREATE TABLE IF NOT EXISTS "issues" ("id" INTEGER);'))
      .toEqual([{ kind: 'table', name: 'issues' }])
    expect(migrationEffects('CREATE TABLE issues (id INTEGER);'))
      .toEqual([{ kind: 'table', name: 'issues' }])
  })

  it('reads ADD COLUMN, with and without IF NOT EXISTS', () => {
    expect(migrationEffects('ALTER TABLE "projects" ADD COLUMN "repository" text;'))
      .toEqual([{ kind: 'column', table: 'projects', name: 'repository' }])
    expect(migrationEffects('ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "repository" text;'))
      .toEqual([{ kind: 'column', table: 'projects', name: 'repository' }])
  })

  it('reads every action in a multi-action ALTER, not just the first', () => {
    const effects = migrationEffects('ALTER TABLE "p" ADD COLUMN "a" text, ADD COLUMN "b" text;')
    expect(effects).toEqual([
      { kind: 'column', table: 'p', name: 'a' },
      { kind: 'column', table: 'p', name: 'b' },
    ])
  })

  it('reads indexes, constraints and enum types', () => {
    expect(migrationEffects('CREATE UNIQUE INDEX IF NOT EXISTS "users_email_index" ON "users" ("email");'))
      .toEqual([{ kind: 'index', name: 'users_email_index' }])
    expect(migrationEffects('ALTER TABLE "posts" ADD CONSTRAINT "posts_author_fk" FOREIGN KEY ("author_id") REFERENCES "authors" ("id");'))
      .toEqual([{ kind: 'constraint', table: 'posts', name: 'posts_author_fk' }])
    expect(migrationEffects(`CREATE TYPE "posts_status_type" AS ENUM ('draft', 'published');`))
      .toEqual([{ kind: 'enum', name: 'posts_status_type' }])
  })

  it('credits the rename in SQLite\'s table-rebuild dance to the final name', () => {
    // bun-query-builder rebuilds a table via `_qb_tmp_<name>`; the rename is
    // what actually leaves `authors` behind, so checking for `_qb_tmp_authors`
    // would report the migration as never applied on every healthy database.
    expect(migrationEffects('ALTER TABLE "_qb_tmp_authors" RENAME TO "authors";'))
      .toEqual([{ kind: 'table', name: 'authors' }])
  })

  it('does not count the rebuild scaffold that gets renamed away', () => {
    // The scaffold is GONE after a successful migration. Counting its CREATE
    // as an effect makes every rebuild look permanently half-applied, which
    // would classify the very migrations #2203 is about as `partial` rather
    // than `stranded` and put them beyond the reconciler's reach.
    const sql = `
      CREATE TABLE IF NOT EXISTS "_qb_tmp_authors" ("id" INTEGER);
      INSERT INTO "_qb_tmp_authors" SELECT * FROM "authors";
      DROP TABLE "authors";
      ALTER TABLE "_qb_tmp_authors" RENAME TO "authors";
    `
    expect(migrationEffects(sql)).toEqual([{ kind: 'table', name: 'authors' }])
  })

  it('drops columns added to the scaffold too, not just the table itself', () => {
    const sql = `
      CREATE TABLE "_qb_tmp_posts" ("id" INTEGER);
      ALTER TABLE "_qb_tmp_posts" ADD COLUMN "slug" TEXT;
      ALTER TABLE "_qb_tmp_posts" RENAME TO "posts";
    `
    expect(migrationEffects(sql)).toEqual([{ kind: 'table', name: 'posts' }])
  })

  it('handles a rename that appears before the create in file order', () => {
    // The filter runs after the whole file is read, so statement order in the
    // emitted SQL cannot change the answer.
    const sql = `
      ALTER TABLE "_qb_tmp_x" RENAME TO "x";
      CREATE TABLE "_qb_tmp_x" ("id" INTEGER);
    `
    expect(migrationEffects(sql)).toEqual([{ kind: 'table', name: 'x' }])
  })

  it('reads MySQL\'s short ADD form without mistaking a constraint for a column', () => {
    expect(migrationEffects('ALTER TABLE `p` ADD `repository` VARCHAR(255);'))
      .toEqual([{ kind: 'column', table: 'p', name: 'repository' }])
    expect(migrationEffects('ALTER TABLE "p" ADD CONSTRAINT "c" FOREIGN KEY ("x") REFERENCES "y" ("id");'))
      .toEqual([{ kind: 'constraint', table: 'p', name: 'c' }])
  })

  it('finds nothing in a pure data migration', () => {
    // The safety-critical case. The shipped corpus contains
    // `0000000098-revoke-legacy-long-lived-tokens.sql`, a hard DELETE. It
    // leaves no schema trace, so it must never look "already applied".
    expect(migrationEffects('DELETE FROM oauth_access_tokens WHERE expires_at < NOW();')).toEqual([])
    expect(migrationEffects('UPDATE teams SET member_count = 0;')).toEqual([])
  })

  it('does not read SQL out of a comment', () => {
    expect(migrationEffects('-- CREATE TABLE "ghost" (id INT);\nCREATE TABLE "real" (id INT);'))
      .toEqual([{ kind: 'table', name: 'real' }])
    expect(migrationEffects('/* CREATE TABLE "ghost" (id INT); */ CREATE TABLE "real" (id INT);'))
      .toEqual([{ kind: 'table', name: 'real' }])
  })

  it('does not read SQL out of a string literal', () => {
    // Otherwise a data migration whose payload mentions DDL would register as
    // creating a table, and then be recorded as applied without ever running.
    expect(migrationEffects(`INSERT INTO audit_log (body) VALUES ('CREATE TABLE "ghost" (id INT)');`))
      .toEqual([])
  })

  it('de-duplicates an effect restated across statements', () => {
    expect(migrationEffects('CREATE TABLE IF NOT EXISTS "a" (id INT);\nCREATE TABLE IF NOT EXISTS "a" (id INT);'))
      .toEqual([{ kind: 'table', name: 'a' }])
  })
})

describe('stripForEffects', () => {
  it('preserves quoted identifiers while blanking literals', () => {
    // The opposite of migration-dialect's stripSqlNoise, which blanks both --
    // that one matches dialect markers, this one needs the names.
    const out = stripForEffects(`CREATE TABLE "users" (name TEXT DEFAULT 'x');`)
    expect(out).toContain('"users"')
    expect(out).not.toContain('\'x\'')
  })

  it('keeps line count and offsets stable', () => {
    const sql = '-- header\nCREATE TABLE "a" (id INT);\n'
    expect(stripForEffects(sql).length).toBe(sql.length)
    expect(stripForEffects(sql).split('\n').length).toBe(sql.split('\n').length)
  })
})

describe('verifiableEffects', () => {
  const all: MigrationEffect[] = [
    { kind: 'table', name: 't' },
    { kind: 'column', table: 't', name: 'c' },
    { kind: 'index', name: 'i' },
    { kind: 'constraint', table: 't', name: 'fk' },
    { kind: 'enum', name: 'e' },
  ]

  it('drops constraints and enums on SQLite', () => {
    // The runner records ADD CONSTRAINT / CREATE TYPE files as executed WITHOUT
    // running them so a later DB_CONNECTION flip can replay the file (#1916).
    // Checking those effects here would report every one as `reverted`.
    expect(verifiableEffects(all, 'sqlite').map(e => e.kind)).toEqual(['table', 'column', 'index'])
  })

  it('drops only enums on MySQL', () => {
    expect(verifiableEffects(all, 'mysql').map(e => e.kind)).toEqual(['table', 'column', 'index', 'constraint'])
  })

  it('keeps everything on Postgres', () => {
    expect(verifiableEffects(all, 'postgres')).toHaveLength(5)
  })
})

describe('classifyMigration', () => {
  const effects = migrationEffects('CREATE TABLE "issues" (id INT);')

  it('calls an unrecorded migration whose effects all exist STRANDED', () => {
    // The #2203 case: applied to the schema, lost from the ledger by a renumber.
    const { present, absent } = split(effects, schema({ tables: ['issues'] }))
    expect(classifyMigration(false, present, absent)).toBe('stranded')
  })

  it('calls an unrecorded migration with no effects present PENDING', () => {
    const { present, absent } = split(effects, schema({}))
    expect(classifyMigration(false, present, absent)).toBe('pending')
  })

  it('calls a half-applied unrecorded migration PARTIAL', () => {
    const two = migrationEffects('CREATE TABLE "a" (id INT);\nCREATE TABLE "b" (id INT);')
    const { present, absent } = split(two, schema({ tables: ['a'] }))
    expect(classifyMigration(false, present, absent)).toBe('partial')
  })

  it('calls a recorded migration whose effects exist APPLIED', () => {
    const { present, absent } = split(effects, schema({ tables: ['issues'] }))
    expect(classifyMigration(true, present, absent)).toBe('applied')
  })

  it('calls a recorded migration whose effects vanished REVERTED', () => {
    const { present, absent } = split(effects, schema({}))
    expect(classifyMigration(true, present, absent)).toBe('reverted')
  })

  it('refuses to guess at a migration with nothing to check', () => {
    // Vacuously "all effects present" is the trap: it would record the corpus's
    // `DELETE FROM oauth_access_tokens` as applied on the strength of having
    // nothing to look for, and the revocation would then never run.
    expect(classifyMigration(false, [], [])).toBe('unverifiable')
  })

  it('still trusts the ledger for a data migration it cannot check', () => {
    expect(classifyMigration(true, [], [])).toBe('applied')
  })
})

describe('planLedgerRemap', () => {
  it('rewrites the reported drift', () => {
    // Verbatim from the issue: same logical migrations, shifted ordinals.
    const ledger = [
      '0000000002-create-alert_channels-table.sql',
      '0000000003-create-issues-table.sql',
      '0000000004-create-error_events-table.sql',
      '0000000006-create-subscriptions-table.sql',
    ]
    const disk = [
      '0000000002-create-issues-table.sql',
      '0000000003-create-error_events-table.sql',
      '0000000004-create-subscriptions-table.sql',
      '0000000005-create-alert_channels-table.sql',
      '0000000006-alter-issues-constraint.sql',
    ]

    const plan = planLedgerRemap(ledger, disk)

    expect(plan.ambiguous).toEqual([])
    expect(plan.dropped).toEqual([])
    expect(plan.remap.sort((a, b) => a.from.localeCompare(b.from))).toEqual([
      { from: '0000000002-create-alert_channels-table.sql', to: '0000000005-create-alert_channels-table.sql' },
      { from: '0000000003-create-issues-table.sql', to: '0000000002-create-issues-table.sql' },
      { from: '0000000004-create-error_events-table.sql', to: '0000000003-create-error_events-table.sql' },
      { from: '0000000006-create-subscriptions-table.sql', to: '0000000004-create-subscriptions-table.sql' },
    ])
  })

  it('leaves rows that already match a file alone', () => {
    const plan = planLedgerRemap(['0000000001-create-a-table.sql'], ['0000000001-create-a-table.sql'])
    expect(plan.remap).toEqual([])
    expect(plan.dropped).toEqual([])
  })

  it('never steals a file an exact match already claims', () => {
    // `0000000001-create-a-table.sql` is recorded and present, so the stale
    // `0000000009-create-a-table.sql` row must NOT be remapped onto it —
    // that would drop a genuine record and re-run the migration.
    const plan = planLedgerRemap(
      ['0000000001-create-a-table.sql', '0000000009-create-a-table.sql'],
      ['0000000001-create-a-table.sql'],
    )
    expect(plan.remap).toEqual([])
    expect(plan.dropped).toEqual(['0000000009-create-a-table.sql'])
  })

  it('reports a deleted migration as dropped rather than remapping it', () => {
    const plan = planLedgerRemap(['0000000007-create-gone-table.sql'], ['0000000001-create-a-table.sql'])
    expect(plan.remap).toEqual([])
    expect(plan.dropped).toEqual(['0000000007-create-gone-table.sql'])
  })

  it('refuses when one logical name matches several files', () => {
    // `auto-misc` recurs across generate runs, so this is reachable in practice.
    const plan = planLedgerRemap(
      ['0000000005-auto-misc.sql'],
      ['0000000001-auto-misc.sql', '0000000002-auto-misc.sql'],
    )
    expect(plan.remap).toEqual([])
    expect(plan.ambiguous).toEqual(['0000000005-auto-misc.sql'])
  })

  it('refuses when two ledger rows converge on one file', () => {
    const plan = planLedgerRemap(
      ['0000000005-auto-misc.sql', '0000000006-auto-misc.sql'],
      ['0000000001-auto-misc.sql'],
    )
    expect(plan.remap).toEqual([])
    expect(plan.ambiguous).toEqual(['0000000005-auto-misc.sql', '0000000006-auto-misc.sql'])
  })

  it('is a no-op on an empty ledger', () => {
    const plan = planLedgerRemap([], ['0000000001-create-a-table.sql'])
    expect(plan).toEqual({ remap: [], ambiguous: [], dropped: [] })
  })
})
