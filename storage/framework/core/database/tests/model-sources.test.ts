// Model resolution for the migration generator.
//
// Two bugs made the generator silently useless, and this suite pins both:
//
//  1. `prepareMigrationModelsDir()` looked only at `app/Models`. A vendored
//     framework checkout and every freshly scaffolded project has no such
//     directory, so generation produced nothing while reporting success, and
//     the committed SQLite corpus became the de facto source of truth.
//  2. bun-query-builder's `loadModels` does `if (st.isDirectory()) continue`,
//     so it reads only the TOP level of the directory it is given. 33 of the
//     62 framework models are nested, including commerce/PrintDevice.ts. A
//     one-line "just point it at the defaults" fix would therefore have
//     emitted 29 of 62 tables and silently dropped print_devices, payments and
//     orders.

import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { withoutProtectedTableDropSql } from '../src/migrations'
import { cleanupModelStaging, resolveModelSources } from '../src/model-sources'

const TMP = join(import.meta.dir, '.tmp-model-sources')

function makeModel(dir: string, name: string) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${name}.ts`), `export default { name: '${name}' }\n`)
}

afterEach(() => {
  rmSync(TMP, { recursive: true, force: true })
  cleanupModelStaging()
})

describe('resolveModelSources', () => {
  it('returns null when neither root holds a model', () => {
    // A project with no models yet is a legitimate state, not an error.
    expect(resolveModelSources({
      userRoot: join(TMP, 'missing-user'),
      frameworkRoot: join(TMP, 'missing-framework'),
    })).toBeNull()
  })

  it('finds NESTED models, which bun-query-builder would skip', () => {
    // The whole reason staging exists.
    const framework = join(TMP, 'framework')
    makeModel(framework, 'User')
    makeModel(join(framework, 'commerce'), 'PrintDevice')
    makeModel(join(framework, 'commerce', 'deep'), 'Payment')

    const resolved = resolveModelSources({ userRoot: join(TMP, 'none'), frameworkRoot: framework })!

    expect(resolved.models.map(m => m.name).sort()).toEqual(['Payment', 'PrintDevice', 'User'])
    expect(resolved.staged).toBe(true)
  })

  it('stages nested models FLAT so the generator can read them all', () => {
    const framework = join(TMP, 'framework')
    makeModel(framework, 'User')
    makeModel(join(framework, 'commerce'), 'PrintDevice')

    const resolved = resolveModelSources({ userRoot: join(TMP, 'none'), frameworkRoot: framework })!
    const staged = readdirSync(resolved.dir).filter(f => f.endsWith('.ts')).sort()

    // Top level of the staging dir must contain every model.
    expect(staged).toEqual(['PrintDevice.ts', 'User.ts'])
  })

  it('uses ONLY userland models once userland has any', () => {
    // stacksjs/stacks#2220. Merging the two roots gave a five-model app the
    // framework's whole demo schema — 88 tables for an app that needed 9.
    const user = join(TMP, 'user')
    const framework = join(TMP, 'framework')
    makeModel(user, 'User')
    makeModel(framework, 'User')
    makeModel(framework, 'Post')

    const resolved = resolveModelSources({ userRoot: user, frameworkRoot: framework })!

    expect(resolved.models.map(m => m.name)).toEqual(['User'])
    expect(resolved.models[0]!.origin).toBe('user')
    expect(resolved.roots).toEqual([user])
  })

  it('reports the framework defaults it left out, and the tables they own', () => {
    const user = join(TMP, 'user')
    const framework = join(TMP, 'framework')
    makeModel(user, 'Project')
    makeModel(framework, 'Cart')
    makeModel(join(framework, 'commerce'), 'PrintDevice')

    const resolved = resolveModelSources({ userRoot: user, frameworkRoot: framework })!

    expect(resolved.excluded.map(m => m.name).sort()).toEqual(['Cart', 'PrintDevice'])
    // Derived exactly as the generator derives them, so the drop suppression
    // in `withoutProtectedTableDropSql` can match what bqb emits.
    expect(resolved.excludedTables).toEqual(['carts', 'print_devices'])
  })

  it('prefers a model file\'s explicit `table` over the pluralised name', () => {
    const user = join(TMP, 'user')
    const framework = join(TMP, 'framework')
    makeModel(user, 'Project')
    mkdirSync(framework, { recursive: true })
    writeFileSync(
      join(framework, 'Person.ts'),
      `export default {\n  name: 'Person',\n  table: 'people',\n}\n`,
    )

    const resolved = resolveModelSources({ userRoot: user, frameworkRoot: framework })!
    expect(resolved.excludedTables).toEqual(['people'])
  })

  it('still merges the defaults in when the app opts back in', () => {
    const user = join(TMP, 'user')
    const framework = join(TMP, 'framework')
    makeModel(user, 'User')
    makeModel(framework, 'User')
    makeModel(framework, 'Post')

    const resolved = resolveModelSources({
      userRoot: user,
      frameworkRoot: framework,
      includeFrameworkDefaults: true,
    })!

    expect(resolved.models.map(m => m.name).sort()).toEqual(['Post', 'User'])
    // Userland still wins the name collision — that is what the merge is for.
    expect(resolved.models.find(m => m.name === 'User')!.origin).toBe('user')
    expect(resolved.excluded).toEqual([])
  })

  it('falls back to the framework defaults when userland has no models', () => {
    // The vendored checkout / fresh scaffold case the fallback exists for.
    const framework = join(TMP, 'framework')
    makeModel(framework, 'User')
    makeModel(framework, 'Post')

    const resolved = resolveModelSources({ userRoot: join(TMP, 'none'), frameworkRoot: framework })!

    expect(resolved.models.map(m => m.name).sort()).toEqual(['Post', 'User'])
    expect(resolved.excluded).toEqual([])
    expect(resolved.excludedTables).toEqual([])
  })

  it('skips index barrels and dotfiles', () => {
    const framework = join(TMP, 'framework')
    makeModel(framework, 'User')
    writeFileSync(join(framework, 'index.ts'), 'export * from "./User"\n')
    writeFileSync(join(framework, '.hidden.ts'), 'export default {}\n')

    const resolved = resolveModelSources({ userRoot: join(TMP, 'none'), frameworkRoot: framework })!
    expect(resolved.models.map(m => m.name)).toEqual(['User'])
  })

  it('rebuilds the staging directory, so a deleted model does not survive', () => {
    const framework = join(TMP, 'framework')
    makeModel(framework, 'User')
    makeModel(join(framework, 'nested'), 'Ghost')

    const first = resolveModelSources({ userRoot: join(TMP, 'none'), frameworkRoot: framework })!
    expect(readdirSync(first.dir).some(f => f === 'Ghost.ts')).toBe(true)

    rmSync(join(framework, 'nested'), { recursive: true, force: true })
    const second = resolveModelSources({ userRoot: join(TMP, 'none'), frameworkRoot: framework })!

    expect(readdirSync(second.dir).some(f => f === 'Ghost.ts')).toBe(false)
  })
})

describe('withoutProtectedTableDropSql', () => {
  // The narrowing in #2220 removes ~62 tables from the model set at once. The
  // generator diffs against the stored snapshot, so without this the very
  // first `generate:migrations` after upgrading proposes dropping all of them.
  const op = (table: string, sql: string) => ({
    kind: 'drop_table' as const,
    table,
    destructive: true,
    sql,
  })

  it('drops the DROP for an out-of-scope framework table', () => {
    const statements = [`DROP TABLE "carts"`, `CREATE TABLE "projects" (id INTEGER)`]
    const result = withoutProtectedTableDropSql(statements, ['carts'], [op('carts', `DROP TABLE "carts"`)])

    expect(result.statements).toEqual([`CREATE TABLE "projects" (id INTEGER)`])
    expect(result.removed).toEqual([`DROP TABLE "carts"`])
  })

  it('leaves a drop of a table the app actually owns alone', () => {
    // A model the user deleted must still generate its drop.
    const statements = [`DROP TABLE "old_projects"`]
    const result = withoutProtectedTableDropSql(statements, ['carts'], [op('old_projects', `DROP TABLE "old_projects"`)])

    expect(result.statements).toEqual(statements)
    expect(result.removed).toEqual([])
  })

  it('matches across dialect spellings of the same drop', () => {
    // Postgres appends CASCADE and MySQL uses backticks, so the operation's
    // `sql` is not always byte-identical to the emitted statement.
    const statements = [`DROP TABLE IF EXISTS \`coupons\``, `DROP TABLE IF EXISTS "carts" CASCADE`]
    const result = withoutProtectedTableDropSql(statements, ['coupons', 'carts'], [])

    expect(result.statements).toEqual([])
    expect(result.removed).toHaveLength(2)
  })

  it('is a no-op when nothing was excluded', () => {
    const statements = [`DROP TABLE "carts"`]
    expect(withoutProtectedTableDropSql(statements, [], [op('carts', `DROP TABLE "carts"`)]).statements)
      .toEqual(statements)
  })

  it('does not touch a DELETE or an ALTER that merely names an excluded table', () => {
    const statements = [
      `ALTER TABLE "carts" ADD COLUMN note VARCHAR(255)`,
      `DELETE FROM "carts"`,
    ]
    expect(withoutProtectedTableDropSql(statements, ['carts'], []).statements).toEqual(statements)
  })
})

describe('resolveModelSources against the real framework defaults', () => {
  it('discovers and flattens shipped models for a project without app/Models', async () => {
    // A contributor may have app/Models locally. Exercise the fallback in an
    // isolated empty app rather than assuming the framework checkout is empty.
    const root = join(TMP, 'default-project')
    mkdirSync(join(root, 'storage/framework'), { recursive: true })
    symlinkSync(join(import.meta.dir, '../../../defaults'), join(root, 'storage/framework/defaults'), 'dir')
    writeFileSync(join(root, 'bunfig.toml'), 'preload = []\n')
    const child = Bun.spawn([process.execPath, `--config=${join(root, 'bunfig.toml')}`, '--no-env-file', join(import.meta.dir, 'fixtures/default-model-discovery.ts')], {
      cwd: root, env: { ...process.env, APP_ENV: 'test' }, stdout: 'pipe', stderr: 'pipe',
    })
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code, `${stdout}\n${stderr}`).toBe(0)
    expect(stdout).toContain('default model discovery OK')
  })
})
