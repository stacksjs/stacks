import type { BuildOutput, BunPlugin } from 'bun'
import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'
import { db as rootDb } from '../src'
import { db as runtimeDb } from '../src/runtime'

const sourceAliases: BunPlugin = {
  name: 'database-runtime-source-aliases',
  setup(build) {
    build.onResolve({ filter: /^@stacksjs\/env(?:\/runtime)?$/ }, ({ path }) => ({
      path: join(import.meta.dir, `../../env/src/${path.endsWith('/runtime') ? 'runtime' : 'index'}.ts`),
    }))
    build.onResolve({ filter: /^@stacksjs\/query-builder$/ }, () => ({
      path: join(import.meta.dir, '../../query-builder/src/index.ts'),
    }))
  },
}

function runtimeBuild(): Promise<BuildOutput> {
  return Bun.build({
    entrypoints: [join(import.meta.dir, '../src/runtime.ts')],
    target: 'bun',
    metafile: true,
    plugins: [sourceAliases],
    write: false,
  })
}

function staticInputs(result: BuildOutput): Set<string> {
  const inputs = result.metafile?.inputs ?? {}
  const entry = Object.keys(inputs).find(source => source.endsWith('/database/src/runtime.ts'))
    ?? Object.keys(inputs).find(source => source === 'src/runtime.ts')
  expect(entry).toBeDefined()

  const reachable = new Set<string>()
  const pending = [entry!]
  while (pending.length > 0) {
    const source = pending.pop()!
    if (reachable.has(source)) continue
    reachable.add(source)
    for (const dependency of inputs[source]?.imports ?? []) {
      if (dependency.kind !== 'dynamic-import' && dependency.path in inputs)
        pending.push(dependency.path)
    }
  }
  return reachable
}

describe('database runtime entry', () => {
  it('shares the root query facade singleton', () => {
    expect(runtimeDb).toBe(rootDb)
  })

  it('keeps migration and tooling modules outside the static graph', async () => {
    const result = await runtimeBuild()

    expect(result.success).toBe(true)
    const inputs = staticInputs(result)
    for (const module of [
      'auth-tables.ts',
      'erd.ts',
      'migrations.ts',
      'schema-drift.ts',
      'schema.ts',
      'seeder.ts',
      'trait-tables.ts',
      'vschema.ts',
    ]) {
      expect([...inputs].some(source => source.endsWith(`/database/src/${module}`))).toBe(false)
    }
    expect([...inputs].some(source => source.includes('/database/src/drivers/'))).toBe(false)
  })

  it('uses the env runtime entry without evaluating the env root', async () => {
    const result = await runtimeBuild()

    expect(result.success).toBe(true)
    const inputs = staticInputs(result)
    expect([...inputs].some(source => source.endsWith('/env/src/runtime.ts'))).toBe(true)
    expect([...inputs].some(source => source.endsWith('/env/src/index.ts'))).toBe(false)
    for (const module of ['cli.ts', 'deployment.ts', 'plaintext.ts', 'tenants.ts', 'utils.ts']) {
      expect([...inputs].some(source => source.endsWith(`/env/src/${module}`))).toBe(false)
    }
  })
})
