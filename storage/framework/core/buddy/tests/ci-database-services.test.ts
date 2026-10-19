import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

interface Step { name: string, uses?: string, with?: Record<string, string>, run?: string, env?: Record<string, string> }
const workflow = Bun.YAML.parse(readFileSync(new URL('../../../../../.github/workflows/ci.yml', import.meta.url), 'utf8')) as {
  jobs: { test: { services?: unknown, steps: Step[] } }
}

for (const [service, version, variable] of [
  ['postgres', '17.11', 'STACKS_TEST_POSTGRES_URL'],
  ['mysql', '26.7.0', 'STACKS_TEST_MYSQL_URL'],
] as const) {
  test(`CI ${service} consumers use Pantry's validated private service exports`, () => {
    const { steps, services } = workflow.jobs.test
    expect(services).toBeUndefined()
    const setup = steps.findIndex(step => step.with?.services?.split(' ').includes(`${service}@${version}`))
    expect(setup).toBeGreaterThanOrEqual(0)
    // Pinned to a full commit, and to the same Pantry as every other setup in
    // the workflow: a hardcoded SHA here went stale the first time the
    // workflow's Pantry moved, and failed on a pin nobody meant to keep.
    const pins = new Set(Object.values(workflow.jobs as Record<string, { steps?: Step[] }>).flatMap(job => job.steps ?? []).map(step => step.uses).filter((uses): uses is string => !!uses?.startsWith('pantry-pm/pantry/packages/action@')))
    expect(steps[setup]!.uses).toMatch(/^pantry-pm\/pantry\/packages\/action@[0-9a-f]{40}$/)
    expect([...pins]).toEqual([steps[setup]!.uses!])
    const configure = steps.findIndex(step => step.run?.includes('bun .github/scripts/configure-ci-services.ts'))
    expect(configure).toBeGreaterThan(setup)
    // The mapper rejects remote hosts, default ports and missing credentials.
    // Both ordinary suites must inherit it rather than override its endpoints.
    for (const name of ['Test Suite', 'Core tests (all packages)']) {
      const consumer = steps.findIndex(step => step.name === name)
      expect(consumer).toBeGreaterThan(configure)
      expect(steps[consumer]!.env?.[variable]).toBeUndefined()
    }
  })
}
