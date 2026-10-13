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
 * A `DO $tag$ BEGIN ... EXCEPTION ... END $tag$` guard is how both the
 * generator and a hand-written Postgres migration make a statement
 * idempotent, and everything that matters is inside it.
 *
 * The ledger used to split statements on `;`, which tore every guard into
 * three fragments beginning `DO $tag$ BEGIN`, so no pattern anchored at the
 * start of a statement could see in. A guarded create registered no effect at
 * all, and no effects is `unverifiable`: deliberately not "every effect
 * present", because a file with nothing to check must not be recorded as
 * applied on the strength of having nothing to check. But an unverifiable file
 * is reported nowhere, so it neither recorded nor showed up as pending
 * (stacksjs/stacks#2900, stacksjs/stacks#2901).
 */
describe('statements inside a DO guard', () => {
  const live = {
    tables: new Set<string>(),
    columns: new Map<string, Set<string>>(),
    indexes: new Set<string>(),
    indexShapes: new Set<string>(),
    constraints: new Set<string>(),
    enums: new Set(['teams_status_type']),
  }

  const guard = (body: string): string => `DO $stacks$ BEGIN ${body} EXCEPTION WHEN duplicate_object THEN null; END $stacks$;`

  it('reads a type out of the guard the generator writes', () => {
    const effects = migrationEffects(guard(`CREATE TYPE "teams_status_type" AS ENUM ('active', 'paused');`))

    expect(effects).toEqual([{ kind: 'enum', name: 'teams_status_type' }])
    expect(effectPresent(effects[0]!, live)).toBe(true)
  })

  it('still reads a bare create, which older corpora hold', () => {
    expect(migrationEffects(`CREATE TYPE "teams_status_type" AS ENUM ('active');`))
      .toEqual([{ kind: 'enum', name: 'teams_status_type' }])
  })

  it('leaves the file verifiable, so it can be recorded rather than vanish', () => {
    // The distinction that matters: an effect the live schema has means
    // `stranded` (record it), while no effects at all means `unverifiable`,
    // and an unverifiable file is reported nowhere.
    const effects = migrationEffects(guard(`CREATE TYPE "teams_status_type" AS ENUM ('active');`))
    const present = effects.filter(effect => effectPresent(effect, live))
    const absent = effects.filter(effect => !effectPresent(effect, live))

    expect(effects.length).toBeGreaterThan(0)
    expect(classifyMigration(false, present, absent)).toBe('stranded')
  })

  it('reads an index, with the shape that matches it under another name', () => {
    // The shape comes from the RAW statement stream, which is read separately
    // from the stripped one so an index predicate keeps its literals. Both
    // streams have to look inside the guard or the effect arrives shapeless,
    // and a shapeless index only ever matches by name.
    expect(migrationEffects(guard(`CREATE UNIQUE INDEX "teams_name_unique" ON "teams" ("name");`)))
      .toEqual([{ kind: 'index', name: 'teams_name_unique', table: 'teams', shape: 'unique teams name' }])
  })

  it('reads a created table and an added column', () => {
    expect(migrationEffects(guard(`CREATE TABLE "teams" ("id" BIGSERIAL PRIMARY KEY);`)))
      .toEqual([{ kind: 'table', name: 'teams' }])
    expect(migrationEffects(guard(`ALTER TABLE "teams" ADD COLUMN "status" text;`)))
      .toEqual([{ kind: 'column', table: 'teams', name: 'status' }])
  })

  it('reads a removal, so a later undo still cancels an earlier effect', () => {
    /*
     * A removal is what keeps an earlier migration from reading as REVERTED
     * once a later one deliberately undoes it, so a drop the ledger cannot see
     * means the migration that created the object is reported as drifted away
     * from history, forever.
     */
    expect(migrationRemovals(guard(`DROP TYPE IF EXISTS "teams_status_type";`)))
      .toEqual([{ kind: 'enum', name: 'teams_status_type' }])
    expect(migrationRemovals(guard(`DROP INDEX IF EXISTS "teams_name_unique";`)))
      .toEqual([{ kind: 'index', name: 'teams_name_unique' }])
    expect(migrationRemovals(`DROP TYPE IF EXISTS "teams_status_type";`))
      .toEqual([{ kind: 'enum', name: 'teams_status_type' }])
  })

  it('keeps a literal that merely mentions DDL from counting as an effect', () => {
    // Why the matching stream is stripped, and why it stays anchored: a data
    // migration carrying DDL in its payload must not register as doing it.
    expect(migrationEffects(`INSERT INTO "notes" ("body") VALUES ('CREATE TABLE "x" ("id" int)');`)).toEqual([])
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
