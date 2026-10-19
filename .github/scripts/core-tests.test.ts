import { describe, expect, it } from 'bun:test'
import { readdirSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { assignShards, AUTH_SHARDS, coreTestUnits, shardNames } from './core-tests'

const root = new URL('../../', import.meta.url).pathname.replace(/\/$/, '')

describe('core test shards', () => {
  const units = coreTestUnits(root)
  const shards = assignShards(units)

  it('runs every package that has tests, each in exactly one shard', () => {
    const packages = readdirSync(join(root, 'storage/framework/core')).filter(pkg => existsSync(join(root, 'storage/framework/core', pkg, 'tests')))
    const run = Object.values(shards).flat().map(item => item.label)
    for (const pkg of packages.filter(pkg => pkg !== 'auth' && pkg !== 'router'))
      expect(run.filter(label => label === `core/${pkg}`)).toHaveLength(1)
    expect(run.filter(label => label.startsWith('core/router (shard ')).sort()).toEqual(['core/router (shard 1/2)', 'core/router (shard 2/2)'])
    expect(run.filter(label => label.startsWith('core/auth (shard ')).sort()).toEqual(Array.from({ length: AUTH_SHARDS }, (_, i) => `core/auth (shard ${i + 1}/${AUTH_SHARDS})`))
    // The three that run from their own directory, for their bunfig preload.
    for (const label of ['core/commerce (src/tests)', 'core/cms (src/tests)', 'core/testing (component-dom fixture)'])
      expect(run.filter(item => item === label)).toHaveLength(1)
    // Nothing invented: every run unit is one the single loop ran, auth's split aside.
    const known = new Set(units.map(item => item.label))
    expect(run.filter(label => !known.has(label) && !label.startsWith('core/auth (shard '))).toEqual([])
  })

  it('keeps the bun test arguments the loop used', () => {
    const byLabel = new Map(Object.values(shards).flat().map(item => [item.label, item]))
    expect(byLabel.get('core/database')!.args).toEqual(['./storage/framework/core/database/tests'])
    expect(byLabel.get('core/router (shard 2/2)')!.args).toEqual(['./storage/framework/core/router/tests', '--shard=2/2'])
    expect(byLabel.get('core/auth (shard 3/4)')!.args).toEqual(['./storage/framework/core/auth/tests', '--shard=3/4'])
    expect(byLabel.get('core/cms (src/tests)')).toMatchObject({ args: ['./src/tests'], cwd: 'storage/framework/core/cms' })
  })

  it('splits the rest evenly, and the same way every time', () => {
    const load = (name: string) => shards[name]!.reduce((sum, item) => sum + item.weight, 0)
    const core = shardNames().filter(name => name.startsWith('core-'))
    expect(Math.max(...core.map(load)) - Math.min(...core.map(load))).toBeLessThan(20)
    expect(assignShards(coreTestUnits(root))).toEqual(shards)
  })

  it('is what the CI matrix runs, shard for shard', () => {
    const workflow = Bun.YAML.parse(readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8')) as any
    expect(workflow.jobs.test.strategy.matrix.shard).toEqual(shardNames())
    const core = workflow.jobs.test.steps.find((step: any) => step.name === 'Core tests (all packages)')
    expect(core.run).toBe('bun .github/scripts/core-tests.ts "${{ matrix.shard }}"')
  })
})
