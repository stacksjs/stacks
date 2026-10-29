import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * The Pantry setup action installs the version `pantry.lock` pins whenever the
 * requested spec admits it, and a bare name admits any version. A workflow that
 * writes `curl.se@8.22.0` instead overrides the lock with a second copy of
 * `deps.yml` that nothing keeps in step, which is how every
 * job came to install curl 8.22.0 and sqlite 3.53.4 while the lock held 8.23.0
 * and 3.54.1, warning about it on each run (stacksjs/stacks#3061).
 *
 * So a system dependency the project declares is named bare, and the lock has to
 * hold it, or the bare name would install whatever is newest.
 */

const root = resolve(import.meta.dir, '..', '..')
const workflows = join(root, '.github/workflows')

// Replays a past cache failure from a fixed commit, so its pins are the fixture.
const FIXTURES = new Set(['native-cache-replay.yml'])

const lock = JSON.parse(readFileSync(join(root, 'pantry.lock'), 'utf8'))
// What `deps.yml` declares, by the domain names the action is given rather than
// the aliases (`curl`) the file uses.
const declared = Object.keys(lock.workspaces?.['']?.system ?? {})
const locked = new Set(
  Object.values(lock.packages ?? {})
    .map(entry => (entry as { name?: string }).name)
    .filter(Boolean),
)

interface Step { uses?: string, with?: { packages?: string } }

function pantrySpecs(): Array<{ workflow: string, job: string, spec: string }> {
  const specs: Array<{ workflow: string, job: string, spec: string }> = []
  for (const workflow of readdirSync(workflows).filter(name => /\.ya?ml$/.test(name) && !FIXTURES.has(name))) {
    const parsed = Bun.YAML.parse(readFileSync(join(workflows, workflow), 'utf8')) as { jobs?: Record<string, { steps?: Step[] }> }
    for (const [job, definition] of Object.entries(parsed.jobs ?? {})) {
      for (const step of definition.steps ?? []) {
        if (!step.uses?.startsWith('pantry-pm/pantry/packages/action@') || !step.with?.packages)
          continue
        // An expression such as `${{ env.BUN_VERSION }}` holds spaces of its own.
        const packages = step.with.packages.replace(/\$\{\{[^}]*\}\}/g, 'expression')
        for (const spec of packages.split(/\s+/).filter(Boolean))
          specs.push({ workflow, job, spec })
      }
    }
  }
  return specs
}

const specName = (spec: string): string => spec.includes('@') ? spec.slice(0, spec.indexOf('@')) : spec

describe('Pantry setup in workflows', () => {
  const specs = pantrySpecs()
  const ofDeclared = specs.filter(({ spec }) => declared.includes(specName(spec)))

  it('finds the declared system dependencies it guards', () => {
    expect(declared).toEqual(expect.arrayContaining(['curl.se', 'git-scm.org', 'sqlite.org']))
    expect(ofDeclared.length).toBeGreaterThan(10)
  })

  it('names a declared system dependency without a version, so pantry.lock decides it', () => {
    const restated = ofDeclared.filter(({ spec }) => spec.includes('@')).map(({ workflow, job, spec }) => `${workflow} ${job}: ${spec}`)
    expect(restated).toEqual([])
  })

  it('only names bare a package pantry.lock holds', () => {
    const unlocked = specs.filter(({ spec }) => !spec.includes('@') && !locked.has(spec)).map(({ workflow, job, spec }) => `${workflow} ${job}: ${spec}`)
    expect(unlocked).toEqual([])
  })
})
