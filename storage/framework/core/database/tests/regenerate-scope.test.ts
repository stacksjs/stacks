/**
 * stacksjs/stacks#2255 — `buddy migrate` and `buddy migrate:regenerate`
 * disagreed about which models define the schema, and the disagreement was
 * destructive in the regenerate direction.
 *
 * The reporting app had 22 models in `app/Models`, 96 committed migrations, and
 * used the framework's auth, queue and payment tables without declaring models
 * for them. `migrate:regenerate --dry-run` proposed removing 95 files and
 * writing 22: the removed set included `users`, `jobs`, `failed_jobs`,
 * `payments`, `subscribers` and `teams`. The output looked clean — one tidy
 * file per model — so committing it was the natural next step, and the next
 * deploy would have dropped the users table.
 *
 * The rule was already right. #2234 established it: never delete a migration
 * this run cannot recreate. It was implemented as "does the file carry the
 * `@generated` marker", a sound proxy while the generator's model scope was
 * fixed, and no longer one after #2220 made the framework defaults a fallback
 * rather than a merge. These tests hold the predicate to the question it was
 * always standing in for: does the corpus about to be written contain this
 * table?
 *
 * The second half covers the same narrowing seen from `buddy migrate`, where
 * it surfaced as two proposed drops of trait pivot tables.
 */

import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  allocateMigrationOrdinals,
  createdTablesOf,
  GENERATED_MIGRATION_MARKER,
  historicallyRootedTables,
  migrationTouchesRootedTable,
  migrationsOutsideCorpus,
  prepareMigrationModelsDir,
  tablesOperatedOn,
  withoutProtectedTableDropSql,
} from '../src/migrations'
import { cleanupModelStaging, resolveModelSources } from '../src/model-sources'
import { traitTableNames } from '../src/trait-tables'

const TMP = join(import.meta.dir, '.tmp-regenerate-scope')

function write(name: string, body: string): void {
  mkdirSync(TMP, { recursive: true })
  writeFileSync(join(TMP, name), `${GENERATED_MIGRATION_MARKER}\n${body}`)
}

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true })
  cleanupModelStaging()
})

describe('tablesOperatedOn', () => {
  it('reads the target of a create, alter, drop and index', () => {
    expect(tablesOperatedOn('CREATE TABLE users (id INTEGER);')).toEqual(['users'])
    expect(tablesOperatedOn('ALTER TABLE posts ADD COLUMN title VARCHAR(255);')).toEqual(['posts'])
    expect(tablesOperatedOn('DROP TABLE IF EXISTS carts;')).toEqual(['carts'])
    expect(tablesOperatedOn('CREATE UNIQUE INDEX posts_slug ON posts (slug);')).toEqual(['posts'])
  })

  it('handles quoted identifiers and IF NOT EXISTS', () => {
    expect(tablesOperatedOn('CREATE TABLE IF NOT EXISTS "failed_jobs" (id INTEGER);')).toEqual(['failed_jobs'])
    expect(tablesOperatedOn('CREATE TABLE `jobs` (id INTEGER);')).toEqual(['jobs'])
  })

  it('does NOT count a foreign key target as a table the file operates on', () => {
    // This is the distinction the whole predicate rests on. Almost every app
    // table references `users`; if that counted, almost nothing would ever be
    // classified as regenerable and the command would stop doing its job.
    const sql = 'CREATE TABLE orders (id INTEGER, user_id INTEGER, FOREIGN KEY (user_id) REFERENCES users(id));'

    expect(tablesOperatedOn(sql)).toEqual(['orders'])
  })

  it('collects every table across a multi-statement file', () => {
    const sql = 'CREATE TABLE a (id INTEGER);\nCREATE TABLE b (id INTEGER);\nALTER TABLE a ADD COLUMN x INTEGER;\n'

    expect(tablesOperatedOn(sql).sort()).toEqual(['a', 'b'])
  })

  it('returns nothing for SQL that names no table', () => {
    expect(tablesOperatedOn('SELECT 1;')).toEqual([])
    expect(tablesOperatedOn(`CREATE TYPE status_type AS ENUM ('a', 'b');`)).toEqual([])
  })
})

describe('createdTablesOf', () => {
  it('reports only tables a statement creates', () => {
    const statements = [
      'CREATE TABLE users (id INTEGER)',
      'ALTER TABLE users ADD COLUMN email VARCHAR(255)',
      'CREATE TABLE IF NOT EXISTS "posts" (id INTEGER)',
      'CREATE INDEX posts_slug ON posts (slug)',
    ]

    expect(createdTablesOf(statements).sort()).toEqual(['posts', 'users'])
  })
})

describe('mixed historical migration corpora', () => {
  it('keeps generated schema deltas that follow an unmarked CREATE', () => {
    mkdirSync(TMP, { recursive: true })
    writeFileSync(join(TMP, '0000000001-create-team_invitations-table.sql'), 'CREATE TABLE team_invitations (id INTEGER);\n')
    write('0000000002-alter-team_invitations-columns.sql', 'ALTER TABLE team_invitations ADD COLUMN pending_key TEXT;')
    write('0000000003-create-automations-table.sql', 'CREATE TABLE automations (id INTEGER);')

    const rooted = new Set(historicallyRootedTables(TMP, readdirSync(TMP)))

    expect([...rooted]).toEqual(['team_invitations'])
    expect(migrationTouchesRootedTable(TMP, '0000000002-alter-team_invitations-columns.sql', rooted)).toBe(true)
    expect(migrationTouchesRootedTable(TMP, '0000000003-create-automations-table.sql', rooted)).toBe(false)
  })

  it('fills gaps before preserved generated follow-up migrations', () => {
    expect(allocateMigrationOrdinals(6, 1834, new Set([1836, 1839]))).toEqual([
      1834,
      1835,
      1837,
      1838,
      1840,
      1841,
    ])
  })
})

describe('migrationsOutsideCorpus (#2255)', () => {
  it('preserves the framework tables from the report', () => {
    // The app's own models are in scope; the framework tables it relies on
    // without declaring are not.
    write('0000000076-create-users-table.sql', 'CREATE TABLE users (id INTEGER);')
    write('0000000028-create-jobs-table.sql', 'CREATE TABLE jobs (id INTEGER);')
    write('0000000044-create-payments-table.sql', 'CREATE TABLE payments (id INTEGER);')
    write('0000000090-create-orders-table.sql', 'CREATE TABLE orders (id INTEGER);')

    const outside = migrationsOutsideCorpus(
      TMP,
      [
        '0000000028-create-jobs-table.sql',
        '0000000044-create-payments-table.sql',
        '0000000076-create-users-table.sql',
        '0000000090-create-orders-table.sql',
      ],
      ['orders'],
    )

    expect(outside).toEqual([
      '0000000028-create-jobs-table.sql',
      '0000000044-create-payments-table.sql',
      '0000000076-create-users-table.sql',
    ])
  })

  it('lets go of a file whose table the corpus rebuilds', () => {
    write('0000000001-create-orders-table.sql', 'CREATE TABLE orders (id INTEGER);')

    expect(migrationsOutsideCorpus(TMP, ['0000000001-create-orders-table.sql'], ['orders'])).toEqual([])
  })

  it('lets go of an ALTER on an in-scope table', () => {
    // The regenerated CREATE TABLE is a full emit, so it already contains what
    // this ALTER added. Preserving it would replay a column that exists.
    write('0000000002-alter-orders-columns.sql', 'ALTER TABLE orders ADD COLUMN total INTEGER;')

    expect(migrationsOutsideCorpus(TMP, ['0000000002-alter-orders-columns.sql'], ['orders'])).toEqual([])
  })

  it('preserves a file that touches an out-of-scope table alongside an in-scope one', () => {
    // Mixed files are kept. Preserving something regenerable is redundant;
    // deleting something unregenerable is unrecoverable, so the tie goes to
    // keeping it.
    write('0000000003-mixed.sql', 'ALTER TABLE orders ADD COLUMN x INTEGER;\nALTER TABLE users ADD COLUMN y INTEGER;')

    expect(migrationsOutsideCorpus(TMP, ['0000000003-mixed.sql'], ['orders'])).toEqual(['0000000003-mixed.sql'])
  })

  it('preserves a file whose SQL names no table at all', () => {
    // 40 files in the shipped corpus are `SELECT 1;` stubs. Nothing here can
    // prove they are regenerable, so they stay.
    write('0000000004-auto-misc.sql', 'SELECT 1;')

    expect(migrationsOutsideCorpus(TMP, ['0000000004-auto-misc.sql'], ['orders'])).toEqual(['0000000004-auto-misc.sql'])
  })

  it('preserves a file it cannot read', () => {
    expect(migrationsOutsideCorpus(TMP, ['no-such-file.sql'], ['orders'])).toEqual(['no-such-file.sql'])
  })

  it('preserves everything when the corpus creates nothing', () => {
    write('0000000001-create-orders-table.sql', 'CREATE TABLE orders (id INTEGER);')

    expect(migrationsOutsideCorpus(TMP, ['0000000001-create-orders-table.sql'], [])).toEqual([
      '0000000001-create-orders-table.sql',
    ])
  })

  it('is case-insensitive about table names', () => {
    write('0000000001-create-orders-table.sql', 'CREATE TABLE Orders (id INTEGER);')

    expect(migrationsOutsideCorpus(TMP, ['0000000001-create-orders-table.sql'], ['ORDERS'])).toEqual([])
  })
})

describe('forceStage keeps regeneration out of app/Models (#2255)', () => {
  it('stages even when a single flat root could be read directly', () => {
    // `regenerateMigrationCorpus` writes a `.qb-migrations.<dialect>.json`
    // sentinel into the resolved directory to force a full emit. Before #2220
    // an app with models of its own always had two roots to merge and so always
    // staged; now it takes the fast path, and without `forceStage` the sentinel
    // is written into the app's own source tree. bun-query-builder reads that
    // file back as "no tables exist" whenever the model snapshot is missing.
    const user = join(TMP, 'models')
    mkdirSync(user, { recursive: true })
    writeFileSync(join(user, 'Project.ts'), `export default { name: 'Project' }\n`)

    const direct = resolveModelSources({ userRoot: user, frameworkRoot: join(TMP, 'absent') })!
    expect(direct.staged).toBe(false)
    expect(direct.dir).toBe(user)

    const staged = resolveModelSources({ userRoot: user, frameworkRoot: join(TMP, 'absent'), forceStage: true })!
    expect(staged.staged).toBe(true)
    expect(staged.dir).not.toBe(user)
    expect(readdirSync(staged.dir)).toEqual(['Project.ts'])
  })

  it('still reports the roots that contributed, not the staging directory', () => {
    // The plan banner reads `roots`, so staging must not make it claim the
    // models came from somewhere under storage/framework.
    const user = join(TMP, 'models')
    mkdirSync(user, { recursive: true })
    writeFileSync(join(user, 'Project.ts'), `export default { name: 'Project' }\n`)

    const staged = resolveModelSources({ userRoot: user, frameworkRoot: join(TMP, 'absent'), forceStage: true })!

    expect(staged.roots).toEqual([user])
  })
})

describe('trait tables are never dropped (#2255)', () => {
  it('prepareMigrationModelsDir protects every trait table', () => {
    // `taggable_models` and `categorizable_models` reach the snapshot as
    // belongsToMany pivots of the framework's Post model, so they leave scope
    // with it — while `excludedTables`, which reads a model's own `table:`,
    // never hears about them.
    const { protectedTables } = prepareMigrationModelsDir()

    for (const table of traitTableNames())
      expect(protectedTables).toContain(table)
  })

  it('suppresses the two drops the report saw', () => {
    const statements = [
      `DROP TABLE "categorizable_models"`,
      `DROP TABLE "taggable_models"`,
      `CREATE TABLE "orders" (id INTEGER)`,
    ]

    const result = withoutProtectedTableDropSql(statements, traitTableNames(), [])

    expect(result.removed).toHaveLength(2)
    expect(result.statements).toEqual([`CREATE TABLE "orders" (id INTEGER)`])
  })

  it('still drops a table that is genuinely gone', () => {
    // The suppression is scoped to framework-owned tables, not a blanket
    // "never drop anything".
    const statements = [`DROP TABLE "old_projects"`]

    expect(withoutProtectedTableDropSql(statements, traitTableNames(), []).statements).toEqual(statements)
  })
})
