import { expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'

/**
 * Every scaffolded workflow sets Pantry up as the CLI only.
 *
 * Left to its default the action also installs the app's system packages.
 * Those include the local mail catcher, which has no Linux download, so the
 * first deploy of a new app failed at "Setup Pantry" before it reached the
 * server (cursio, 2026-11-13). No workflow needs them: Bun has its own step.
 */
const dir = new URL('../../../defaults/vcs/github/workflows/', import.meta.url)

interface Step { name?: string, uses?: string, with?: Record<string, unknown> }

test('every Setup Pantry step in a scaffolded workflow skips the package install', () => {
  const steps = readdirSync(dir)
    .filter(file => file.endsWith('.yml'))
    .flatMap((file) => {
      const workflow = Bun.YAML.parse(readFileSync(new URL(file, dir), 'utf8')) as { jobs?: Record<string, { steps?: Step[] }> }
      return Object.values(workflow.jobs ?? {})
        .flatMap(job => job.steps ?? [])
        .filter(step => step.uses?.startsWith('pantry-pm/pantry/packages/action@'))
        .map(step => ({ file, install: String(step.with?.install) }))
    })

  expect(steps.length).toBeGreaterThan(0)
  expect(steps.filter(step => step.install !== 'false')).toEqual([])
})
