import { Database } from 'bun:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { comparableIndexKey, postgresIndexStatement } from '../src/index-shape'
import { classifyMigration, effectPresent, migrationEffects, migrationRemovals, reconcileMigrationLedger } from '../src/migration-ledger'

/**
 * `migrate:regenerate --force` against a database with history left the next
 * `migrate` re-running the whole regenerated corpus. Two things kept the
 * reconciler from recording files whose every object already existed:
 *
 *   - indexes were matched by NAME. An older generator's spelling sometimes ran
 *     past Postgres's 63-character limit, so the server kept a truncated
 *     prefix while the current generator hashes the tail - the two never meet,
 *     and the file read as half-applied;
 *   - a regenerated file was repointed by logical name onto the old row, so a
 *     `create-x-table` that now declares an index the old one never had was
 *     recorded as applied, and the index never built.
 */

describe('index effects match by shape', () => {
  it('finds an index under a truncated legacy name', () => {
    const [effect] = migrationEffects(`CREATE UNIQUE INDEX IF NOT EXISTS "trainer_client_assignments_organization_id_member_user__186exwq" ON "trainer_client_assignments" ("team_id", "member_user_id", "trainer_user_id");`)
    const live = `CREATE UNIQUE INDEX trainer_client_assignments_trainer_client_assignments_organizat ON public.trainer_client_assignments USING btree (team_id, member_user_id, trainer_user_id)`
    const schema = {
      tables: new Set<string>(),
      columns: new Map<string, Set<string>>(),
      indexes: new Set(['trainer_client_assignments_trainer_client_assignments_organizat']),
      indexShapes: new Set([comparableIndexKey(postgresIndexStatement(live))!]),
      constraints: new Set<string>(),
      enums: new Set<string>(),
    }

    expect(effectPresent(effect!, schema)).toBe(true)
  })

  it('does not count a different index on the same columns', () => {
    const [effect] = migrationEffects(`CREATE UNIQUE INDEX "t_email_unique" ON "t" ("email");`)
    const schema = {
      tables: new Set<string>(),
      columns: new Map<string, Set<string>>(),
      indexes: new Set(['t_email_index']),
      indexShapes: new Set([comparableIndexKey(postgresIndexStatement('CREATE INDEX t_email_index ON public.t USING btree (email)'))!]),
      constraints: new Set<string>(),
      enums: new Set<string>(),
    }

    expect(effectPresent(effect!, schema)).toBe(false)
  })

  it('reads the server\'s spelling of a partial expression index as the migration\'s', () => {
    const written = comparableIndexKey(`CREATE UNIQUE INDEX "t_partial" ON "t" (lower("email")) WHERE "deleted_at" IS NULL AND "status" = 'a'`)
    const catalog = comparableIndexKey(postgresIndexStatement(`CREATE UNIQUE INDEX t_partial ON public.t USING btree (lower((email)::text)) WHERE ((deleted_at IS NULL) AND ((status)::text = 'a'::text))`))
    const other = comparableIndexKey(postgresIndexStatement(`CREATE UNIQUE INDEX t_partial ON public.t USING btree (lower((email)::text)) WHERE ((deleted_at IS NULL) AND ((status)::text = 'b'::text))`))

    expect(catalog).toBe(written)
    expect(other).not.toBe(written)
  })
})

/**
 * A generated types file is a guarded create, so the `CREATE TYPE` sits inside
 * a `DO $stacks$ BEGIN ... EXCEPTION WHEN duplicate_object THEN null; END`
 * block rather than at the start of the statement.
 *
 * The ledger used to look for it with an anchored pattern, so a regenerated
 * `create-database-types.sql` produced no effects at all. With nothing to
 * verify it classified as `unverifiable`, which is neither recorded as already
 * applied nor reported as pending: the file fell out of the reconciler's
 * output entirely, and the next migrate re-ran a create whose type already
 * existed (stacksjs/stacks#2900).
 */
describe('a guarded enum create is still an effect', () => {
  const live = {
    tables: new Set<string>(),
    columns: new Map<string, Set<string>>(),
    indexes: new Set<string>(),
    indexShapes: new Set<string>(),
    constraints: new Set<string>(),
    enums: new Set(['teams_status_type']),
  }

  it('reads the type out of the guard the generator writes', () => {
    const effects = migrationEffects(`DO $stacks$ BEGIN CREATE TYPE "teams_status_type" AS ENUM ('active', 'paused'); EXCEPTION WHEN duplicate_object THEN null; END $stacks$;`)

    expect(effects).toEqual([{ kind: 'enum', name: 'teams_status_type' }])
    expect(effectPresent(effects[0]!, live)).toBe(true)
  })

  it('still reads a bare create, which older corpora hold', () => {
    const effects = migrationEffects(`CREATE TYPE "teams_status_type" AS ENUM ('active');`)

    expect(effects).toEqual([{ kind: 'enum', name: 'teams_status_type' }])
  })

  it('reads a dropped type out of a guard as well', () => {
    /*
     * The mirror of the create. A removal is what keeps an earlier migration
     * from reading as REVERTED once a later one deliberately undoes it, so a
     * drop the ledger cannot see means the migration that created the type is
     * reported as drifted away from history, forever.
     *
     * Nothing in the framework generates a guarded drop. An application's own
     * migration is where this comes from: the guard is the idiomatic way to
     * write an idempotent `DROP TYPE` in Postgres.
     */
    const guarded = migrationRemovals(`DO $stacks$ BEGIN DROP TYPE IF EXISTS "teams_status_type"; EXCEPTION WHEN undefined_object THEN null; END $stacks$;`)

    expect(guarded).toEqual([{ kind: 'enum', name: 'teams_status_type' }])
    expect(migrationRemovals(`DROP TYPE IF EXISTS "teams_status_type";`)).toEqual([{ kind: 'enum', name: 'teams_status_type' }])
  })

  it('leaves the file verifiable, so it can be recorded rather than vanish', () => {
    // The distinction that matters: an effect the live schema has means
    // `stranded` (record it), while no effects at all means `unverifiable`,
    // and an unverifiable file is reported nowhere.
    const effects = migrationEffects(`DO $stacks$ BEGIN CREATE TYPE "teams_status_type" AS ENUM ('active'); EXCEPTION WHEN duplicate_object THEN null; END $stacks$;`)
    const present = effects.filter(effect => effectPresent(effect, live))

    expect(effects.length).toBeGreaterThan(0)
    expect(classifyMigration(false, present, effects.filter(effect => !effectPresent(effect, live)))).toBe('stranded')
  })
})

describe('reconcileMigrationLedger after a regeneration', () => {
  let dir: string
  let db: Database

  const run = async (sql: string): Promise<any[]> => db.query(sql).all() as any[]
  const ledger = (): string[] => (db.query('SELECT migration FROM migrations ORDER BY migration').all() as any[]).map(r => r.migration)

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ledger-regenerated-'))
    // The regenerated corpus on disk.
    writeFileSync(join(dir, '0000000001-create-teams-table.sql'), `-- qb:generated
CREATE TABLE IF NOT EXISTS "teams" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS "teams_name_unique" ON "teams" ("name");`)
    writeFileSync(join(dir, '0000000002-create-posts-table.sql'), `-- qb:generated
CREATE TABLE IF NOT EXISTS "posts" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "title" TEXT);
CREATE INDEX IF NOT EXISTS "posts_title_index" ON "posts" ("title");`)

    // The database the old, hand-written corpus built.
    db = new Database(':memory:')
    db.run('CREATE TABLE teams (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)')
    db.run('CREATE UNIQUE INDEX "teams_legacy_name_key" ON "teams" ("name")')
    db.run('CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT)')
    db.run('CREATE TABLE migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, migration VARCHAR(255) NOT NULL UNIQUE, executed_at DATETIME DEFAULT CURRENT_TIMESTAMP)')
    for (const row of ['0000000003-create-teams-table.sql', '0000000004-create-posts-table.sql', '0000000005-clear-tokens.sql'])
      db.run(`INSERT INTO migrations (migration) VALUES ('${row}')`)
  })

  afterEach(() => {
    db.close()
    rmSync(dir, { recursive: true, force: true })
  })

  const regenerated = {
    removed: ['0000000003-create-teams-table.sql', '0000000004-create-posts-table.sql', '0000000005-clear-tokens.sql'],
    written: ['0000000001-create-teams-table.sql', '0000000002-create-posts-table.sql'],
  }

  it('records what the schema has, leaves what it lacks to run, and retires the replaced rows', async () => {
    const result = await reconcileMigrationLedger({ dir, dialect: 'sqlite', run, regenerated })

    expect(result.remapped).toEqual([])
    // Every effect present, the unique index under its legacy name.
    expect(result.recorded).toEqual(['0000000001-create-teams-table.sql'])
    // posts_title_index exists under no name: left pending, with the way out.
    expect(result.skipped.map(entry => entry.file)).toEqual(['0000000002-create-posts-table.sql'])
    expect(result.skipped[0]!.reason).toContain('migrate:align')
    expect(result.retired.sort()).toEqual(regenerated.removed)
    expect(ledger()).toEqual(['0000000001-create-teams-table.sql'])
  })

  it('reports the same on a dry run without writing', async () => {
    const result = await reconcileMigrationLedger({ dir, dialect: 'sqlite', run, regenerated, dryRun: true })

    expect(result.retired.sort()).toEqual(regenerated.removed)
    expect(ledger()).toHaveLength(3)
  })

  it('still repoints by logical name without a regeneration', async () => {
    const result = await reconcileMigrationLedger({ dir, dialect: 'sqlite', run })

    expect(result.remapped.map(r => r.to).sort()).toEqual(regenerated.written)
    expect(result.retired).toEqual([])
    expect(result.skipped.map(entry => entry.file)).toContain('0000000005-clear-tokens.sql')
  })

  it('never retires a row whose file is still on disk', async () => {
    const result = await reconcileMigrationLedger({
      dir,
      dialect: 'sqlite',
      run,
      regenerated: { removed: [...regenerated.removed, '0000000001-create-teams-table.sql'], written: regenerated.written },
    })

    expect(result.retired).not.toContain('0000000001-create-teams-table.sql')
  })
})
