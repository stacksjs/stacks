import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_LIBRARY_SOURCE_CI } from '../../actions/src/library/release-plan'

type Step = { name?: string, id?: string, run?: string, uses?: string, if?: string, env?: Record<string, string>, with?: Record<string, unknown> }
type Job = { name: string, needs?: string[], if?: string, permissions?: Record<string, string>, steps: Step[] }
const templates = join(import.meta.dir, '../../../defaults/vcs/github/workflows')
const ci = Bun.YAML.parse(readFileSync(join(templates, 'ci.yml'), 'utf8')) as { jobs: Record<string, Job> }
const release = Bun.YAML.parse(readFileSync(join(templates, 'release.yml'), 'utf8')) as { permissions: Record<string, string>, jobs: Record<string, Job> }

test('default source job policy exactly matches the scaffold and keeps tested candidate bytes', () => {
  expect(Object.values(ci.jobs).map(job => job.name).sort()).toEqual([...DEFAULT_LIBRARY_SOURCE_CI.requiredJobs].sort())
  expect(ci.jobs.test!.needs).toEqual(['lint', 'typecheck'])
  const steps = ci.jobs.test!.steps
  const prepare = steps.findIndex(step => step.run === 'bun buddy release:prepare')
  const tests = steps.findIndex(step => step.name === 'Test Suite')
  const upload = steps.findIndex(step => step.with?.name === 'stacks-library-candidate')
  expect(prepare).toBeGreaterThan(0)
  expect(tests).toBeGreaterThan(prepare)
  expect(upload).toBeGreaterThan(tests)
  expect(steps[upload]!.if).toContain("steps.library.outputs.prepared == 'true'")
  expect(steps[upload]!.if).toContain("steps.library.outputs.source_eligible == 'true'")
  expect(steps[upload]!.with?.['if-no-files-found']).toBe('error')
})

test('default tag lifecycle uses current verifier, read-only acceptance and publisher-only credentials', () => {
  expect(release.permissions).toEqual({ contents: 'read' })
  expect(release.jobs.accept!.permissions).toEqual({ contents: 'read', actions: 'read' })
  expect(release.jobs.publish!.permissions).toEqual({ contents: 'read', actions: 'read' })
  for (const job of Object.values(release.jobs)) {
    const checkout = job.steps.find(step => step.uses?.startsWith('actions/checkout@'))
    expect(checkout!.with!.ref).toBe('${{ github.event.repository.default_branch }}')
    for (const step of job.steps) {
      expect(step.env?.GITHUB_SHA).toBeUndefined()
      if (Object.values(step.env ?? {}).some(value => value.includes('secrets.NPM_TOKEN'))) {
        expect(job.name).toBe('Publish exact libraries')
        expect(step.run).toContain('bun buddy release:publish')
        expect(step.run).toContain('umask 077')
      }
      expect(step.run ?? '').not.toContain('${{')
    }
  }
  expect(release.jobs.publish!.if).toContain("needs.accept.outputs.accepted == 'true'")
  expect(release.jobs.release!.if).toContain("needs.accept.outputs.accepted != 'true'")
  const github = release.jobs.release!.steps.find(step => step.name === 'Create standard GitHub release')!
  expect(github.run).toContain('release:github "$RELEASE_TAG" --assets')
  expect(github.run).toContain('registry-receipt.json')
  expect(Object.values(release.jobs).flatMap(job => job.steps).some(step => /build:libs|libs:build|pm pack|release:prepare/.test(step.run ?? ''))).toBe(false)
})
