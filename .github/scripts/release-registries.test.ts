import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { registryOutputs, releaseRegistries } from './release-registries'

describe('release registries', () => {
  it('publishes to Pantry alone unless configured', () => {
    expect(releaseRegistries(undefined)).toEqual(['pantry'])
    expect(releaseRegistries('')).toEqual(['pantry'])
    expect(releaseRegistries('  ')).toEqual(['pantry'])
  })

  it('takes a configured list in any order and spelling', () => {
    expect(releaseRegistries('npm,pantry')).toEqual(['pantry', 'npm'])
    expect(releaseRegistries('NPM')).toEqual(['npm'])
    expect(releaseRegistries('pantry npm')).toEqual(['pantry', 'npm'])
  })

  it('refuses an unknown registry instead of dropping it', () => {
    expect(() => releaseRegistries('pantry,nmp')).toThrow('nmp')
  })

  it('writes one output per registry', () => {
    expect(registryOutputs(['pantry'])).toBe('pantry=true\nnpm=false')
  })

  it('gates every npm-only step of the Releaser on the npm output', () => {
    const workflow = Bun.YAML.parse(readFileSync(new URL('../workflows/release.yml', import.meta.url), 'utf8')) as any
    const steps = workflow.jobs.publish.steps as { name: string, if?: string, run?: string, env?: Record<string, string> }[]
    const npmOnly = steps.filter(step => /--npm|npm dist-tag|promote-latest|resume-npm-publication|publish-dummy-libs|bun add --no-cache/.test(step.run ?? ''))
    expect(npmOnly.map(step => step.name)).toEqual([
      'Verify original npm publications before resuming',
      'Publish Framework to npm',
      'Verify published framework install from npm',
      'Publish Dummy Libraries',
    ])
    for (const step of npmOnly) expect(step.if).toContain('steps.registries.outputs.npm == \'true\'')

    const pantry = steps.filter(step => step.if?.includes('steps.registries.outputs.pantry'))
    expect(pantry.map(step => step.name)).toEqual(['Publish Framework to Pantry', 'Verify Pantry publication'])
    expect(pantry[0]!.env!.PANTRY_TOKEN).toBe('${{ secrets.PANTRY_TOKEN }}')
    expect(steps.find(step => step.name === 'Resolve release registries')!.env!.RELEASE_REGISTRIES).toBe('${{ vars.RELEASE_REGISTRIES }}')
  })
})
