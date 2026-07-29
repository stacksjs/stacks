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
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { prepareMigrationModelsDir } from '../src/migrations'
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

  it('lets a userland model override a framework model of the same name', () => {
    const user = join(TMP, 'user')
    const framework = join(TMP, 'framework')
    makeModel(user, 'User')
    makeModel(framework, 'User')
    makeModel(framework, 'Post')

    const resolved = resolveModelSources({ userRoot: user, frameworkRoot: framework })!
    const userModel = resolved.models.find(m => m.name === 'User')!

    expect(userModel.origin).toBe('user')
    expect(resolved.models).toHaveLength(2)
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

describe('resolveModelSources against the real framework defaults', () => {
  it('finds every shipped model, nested ones included', () => {
    const resolved = resolveModelSources()

    expect(resolved).not.toBeNull()
    // If this drops sharply, the nested-model regression is back.
    expect(resolved!.models.length).toBeGreaterThan(55)
    expect(resolved!.models.some(m => m.name === 'PrintDevice')).toBe(true)
  })

  it('exposes a directory that exists and is flat', () => {
    const resolved = resolveModelSources()!
    expect(existsSync(resolved.dir)).toBe(true)

    const staged = readdirSync(resolved.dir).filter(f => f.endsWith('.ts'))
    expect(staged.length).toBe(resolved.models.length)
  })

  it('feeds framework defaults to migration generation without app/Models', () => {
    const prepared = prepareMigrationModelsDir()

    expect(prepared.skip).toBe(false)
    expect(existsSync(prepared.modelsDir)).toBe(true)
    expect(readdirSync(prepared.modelsDir).some(file => file === 'User.ts')).toBe(true)
  })
})
