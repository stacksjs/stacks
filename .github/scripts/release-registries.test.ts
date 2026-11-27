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
    const sample = steps.find(step => step.name === 'Publish Dummy Libraries')!
    const resume = steps.find(step => step.name === 'Verify original npm publications before resuming')!
    const node = steps.find(step => step.name === 'Setup Node for trusted sample publishing')!
    expect(node.if).toBe(sample.if)
    expect(sample.env?.STACKS_NPM_RESUME_RECEIPTS).toBe(resume.env?.STACKS_NPM_RESUME_RECEIPTS)
    expect(JSON.stringify(sample.env)).not.toContain('secrets.NPM_TOKEN')

    const pantry = steps.filter(step => step.if?.includes('steps.registries.outputs.pantry'))
    expect(pantry.map(step => step.name)).toEqual(['Publish Framework to Pantry', 'Verify Pantry publication'])
    expect(pantry[0]!.env!.PANTRY_TOKEN).toBe('${{ secrets.PANTRY_TOKEN }}')
    expect(steps.find(step => step.name === 'Resolve release registries')!.env!.RELEASE_REGISTRIES).toBe('${{ vars.RELEASE_REGISTRIES }}')
  })

  it('requires the original archive check before staged OIDC publication and verifies latest before install', () => {
    const workflow = Bun.YAML.parse(readFileSync(new URL('../workflows/release.yml', import.meta.url), 'utf8')) as any
    const publish = workflow.jobs.publish
    const steps = publish.steps as { name: string, run?: string, env?: Record<string, string> }[]
    const resume = steps.findIndex(step => step.name === 'Verify original npm publications before resuming')
    const npm = steps.findIndex(step => step.name === 'Publish Framework to npm')
    const smoke = steps.findIndex(step => step.name === 'Verify published framework install from npm')
    expect(resume).toBeGreaterThanOrEqual(0)
    expect(npm).toBeGreaterThan(resume)
    expect(smoke).toBeGreaterThan(npm)
    expect(publish.environment).toBeUndefined()
    expect(workflow.permissions['id-token']).toBe('write')
    expect(steps[npm]!.env?.RELEASE_NPM_OIDC_PERMISSIONS).toBe('${{ vars.RELEASE_NPM_OIDC_PERMISSIONS }}')
    expect(steps[npm]!.env?.STACKS_NPM_RESUME_RECEIPTS).toBe(steps[resume]!.env?.STACKS_NPM_RESUME_RECEIPTS)
    const run = steps[npm]!.run!
    expect(run).toMatch(/--publication-tag[\s\S]+staging-oidc[\s\S]+unset NPM_TOKEN[\s\S]+promotion_args\+=\(--oidc\)[\s\S]+--tag staging[\s\S]+promote-latest\.ts "\$\{promotion_args\[@\]\}"[\s\S]+--has-resumed-upload stacks[\s\S]+pantry publish --npm/)
    expect(steps[smoke]!.run).toMatch(/--verify-umbrella[\s\S]+bun add --no-cache "stacks@\$version"/)
  })
})
