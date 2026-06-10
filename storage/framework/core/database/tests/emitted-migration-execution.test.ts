import { afterAll, describe, expect, it, spyOn } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { path as stacksPath } from '@stacksjs/path'
import { createAlterTableMigration as createMysqlAlterTableMigration, generateIndexCreationSQL as mysqlIndexSQL, generateMysqlMigration } from '../src/drivers/mysql'
import { generateIndexCreationSQL as postgresIndexSQL, generatePostgresMigration } from '../src/drivers/postgres'
import { generateIndexCreationSQL as sqliteIndexSQL } from '../src/drivers/sqlite'

// stacksjs/stacks#1954 follow-up — the wave-1 fix repaired `_db` inside the
// likeable upvote block, but the SAME generated `up(db)` body still pulled in
// `(_db as any)` via generatePrimaryKeyIndexSQL (mysql), the alter-table
// generators (mysql + postgres), and the postgres belongsToMany pivot
// generator — so emitted migrations crashed with
// `ReferenceError: _db is not defined` before ever reaching the pivot DDL.
//
// The earlier regression tests only grepped source-text slices, which is how
// the residue survived. These tests EXECUTE the generator's actual emitted
// output: the real generators run (with `Bun.write` intercepted so nothing
// lands in database/migrations), and each captured migration is transpiled
// and its `up()` invoked against a permissive chainable mock. Any unresolved
// identifier in the emitted body — the `_db` defect class — throws.

/** Chainable stand-in for the kysely-style `db` the emitted `up()` receives.
 * Every property access / call returns the chain; function args (col
 * callbacks) are invoked so emitted callback bodies are exercised too. */
function chain(): any {
  const fn: any = () => {}
  const proxy: any = new Proxy(fn, {
    get(_t, prop) {
      // not a thenable — `await chain.execute()` must resolve, not recurse
      if (prop === 'then')
        return undefined
      return proxy
    },
    apply(_t, _self, args) {
      for (const arg of args) {
        if (typeof arg === 'function')
          arg(proxy)
      }
      return proxy
    },
  })
  return proxy
}

const sqlStub: any = () => chain()
sqlStub.raw = (s: string) => s

/** Transpiles an emitted migration and runs its `up()` against the mock.
 * Imports are dropped: the stubs replace them, and importing the
 * @stacksjs/database barrel from a test deadlocks bun's loader (see
 * drivers/helpers.ts). */
async function execEmittedUp(content: string): Promise<void> {
  const withoutImports = content
    .split('\n')
    .filter(line => !line.startsWith('import '))
    .join('\n')
    .replace('export async function up', 'async function up')
  const js = new Bun.Transpiler({ loader: 'ts' }).transformSync(withoutImports)
  // eslint-disable-next-line no-new-func
  const up = new Function('sql', `${js}\nreturn up`)(sqlStub)
  await up(chain())
}

/** Runs a generator with `Bun.write` intercepted, returning every emitted
 * migration keyed by destination path — nothing touches database/migrations. */
async function captureEmittedMigrations(run: () => Promise<void>): Promise<Map<string, string>> {
  const captured = new Map<string, string>()
  const writeSpy = spyOn(Bun, 'write').mockImplementation((async (dest: any, content: any) => {
    captured.set(String(dest), String(content))
    return 0
  }) as any)
  try {
    await run()
  }
  finally {
    writeSpy.mockRestore()
  }
  return captured
}

function findEmitted(captured: Map<string, string>, fileNamePart: string): string {
  for (const [dest, content] of captured) {
    if (dest.includes(fileNamePart))
      return content
  }
  throw new Error(`no emitted migration matching "${fileNamePart}" — captured: ${[...captured.keys()].join(', ')}`)
}

const tmpModelsDir = mkdtempSync(join(tmpdir(), 'stacks-emitted-migrations-'))
const cacheModelsDir = stacksPath.frameworkPath('cache/models')
const cacheCopies = ['TmpEmitMysql.ts', 'TmpEmitPostgres.ts', 'TmpEmitAlter.ts']
// belongsToMany resolves the related model BY NAME from userModelsPath, so
// the related side must be a real file there. A plain temp object keeps the
// test self-contained — importing a defineModel-based core model (e.g. User)
// drags the orm/security/validation graph into the test.
const relatedModelPath = stacksPath.userModelsPath('TmpEmitRelated.ts')

afterAll(() => {
  rmSync(tmpModelsDir, { recursive: true, force: true })
  rmSync(relatedModelPath, { force: true })
  try {
    // remove app/Models again if this test created it (rmdir refuses non-empty)
    rmdirSync(stacksPath.userModelsPath(''))
  }
  catch {}
  for (const file of cacheCopies)
    rmSync(join(cacheModelsDir, file), { force: true })
})

describe('emitted mysql migrations execute (stacksjs/stacks#1954)', () => {
  it('create-table migration with likeable runs to completion, including the pivot DDL', async () => {
    const modelPath = join(tmpModelsDir, 'TmpEmitMysql.ts')
    // Plain default-export object — same shape the generators consume; using
    // defineModel here would drag the orm barrel into the test module graph.
    writeFileSync(modelPath, `export default {
  name: 'TmpEmitMysql',
  table: 'tmp_emit_mysql_rows',
  primaryKey: 'id',
  traits: { likeable: true },
  attributes: {},
}
`)
    // a stale snapshot would make the generator early-return as "unchanged"
    rmSync(join(cacheModelsDir, 'TmpEmitMysql.ts'), { force: true })

    const captured = await captureEmittedMigrations(() => generateMysqlMigration(modelPath))
    const content = findEmitted(captured, 'create-tmp_emit_mysql_rows-table')

    // the likeable pivot must be part of the same up() body…
    expect(content).toContain(`createTable('tmp_emit_mysql_rows_likes')`)
    // …and the whole body must execute: pre-fix this threw
    // `ReferenceError: _db is not defined` at the generated
    // `<table>_id_index` statement, one line before the pivot block.
    await execEmittedUp(content)
  })

  it('alter-table migration runs to completion', async () => {
    const modelPath = join(tmpModelsDir, 'TmpEmitAlter.ts')
    writeFileSync(modelPath, `export default {
  name: 'TmpEmitAlter',
  table: 'tmp_emit_alter_rows',
  primaryKey: 'id',
  attributes: { title: { order: 1 } },
}
`)
    // seed the model snapshot the alter generator diffs against
    mkdirSync(cacheModelsDir, { recursive: true })
    writeFileSync(join(cacheModelsDir, 'TmpEmitAlter.ts'), `export default {
  name: 'TmpEmitAlter',
  table: 'tmp_emit_alter_rows',
  primaryKey: 'id',
  attributes: {},
}
`)

    const captured = await captureEmittedMigrations(() => createMysqlAlterTableMigration(modelPath))
    const content = findEmitted(captured, 'alter-tmp_emit_alter_rows-table')

    expect(content).toContain(`alterTable('tmp_emit_alter_rows')`)
    await execEmittedUp(content)
  })
})

describe('emitted postgres migrations execute (stacksjs/stacks#1954)', () => {
  it('belongsToMany pivot and likeable create-table migrations run to completion', async () => {
    const modelPath = join(tmpModelsDir, 'TmpEmitPostgres.ts')
    mkdirSync(stacksPath.userModelsPath(''), { recursive: true })
    writeFileSync(relatedModelPath, `export default {
  name: 'TmpEmitRelated',
  table: 'tmp_emit_relateds',
  primaryKey: 'id',
  attributes: {},
}
`)
    writeFileSync(modelPath, `export default {
  name: 'TmpEmitPostgres',
  table: 'tmp_emit_reviews',
  primaryKey: 'id',
  traits: { likeable: true },
  belongsToMany: ['TmpEmitRelated'],
  attributes: {},
}
`)
    rmSync(join(cacheModelsDir, 'TmpEmitPostgres.ts'), { force: true })

    const captured = await captureEmittedMigrations(() => generatePostgresMigration(modelPath))

    // pivot migration: pre-fix its FK/unique/index statements referenced
    // `(_db as any)` under an `up(db)` signature → ReferenceError.
    const pivot = [...captured.values()].find(content => content.includes('addForeignKeyConstraint'))
    expect(pivot).toBeDefined()
    await execEmittedUp(pivot as string)

    const table = findEmitted(captured, 'create-tmp_emit_reviews-table')
    expect(table).toContain(`createTable('tmp_emit_reviews_likes')`)
    await execEmittedUp(table)
  })
})

describe('index-helper output executes inside the emitted up(db) (stacksjs/stacks#1954)', () => {
  for (const [driver, fn] of [['sqlite', sqliteIndexSQL], ['mysql', mysqlIndexSQL], ['postgres', postgresIndexSQL]] as const) {
    it(`${driver}: simple-index DDL references the up(db) parameter`, async () => {
      const ddl = fn('users', { name: 'idx_users_email', columns: ['email'] })
      await execEmittedUp(`export async function up(db: Database<any>) {\n${ddl}}\n`)
    })
  }
})

// Belt-and-braces for paths not executed above (private FK-index helpers,
// the postgres alter generator): no emission site in any driver may
// reference `_db` — every generated signature is `up(db)`.
describe('no `(_db` reference survives in any legacy generator (stacksjs/stacks#1954)', () => {
  for (const driver of ['sqlite', 'mysql', 'postgres'] as const) {
    it(`${driver}.ts has no (_db occurrences`, () => {
      const source = readFileSync(resolve(__dirname, `../src/drivers/${driver}.ts`), 'utf-8')
      expect(source).not.toContain('(_db')
    })
  }
})
