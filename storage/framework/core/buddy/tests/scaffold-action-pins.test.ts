import { readdirSync, readFileSync } from 'node:fs'
import { expect, test } from 'bun:test'

/**
 * Actions in the workflows a new app is scaffolded with are pinned.
 *
 * `deploy.yml` and `preview.yml` ran `home-lang/pantry/packages/action@main`
 * while every other scaffolded workflow used a pinned SHA, and those two are
 * the ones that load `DEPLOY_SSH_KEY` and a `DOTENV_PRIVATE_KEY_*`. An action
 * runs arbitrary code in its job, so a mutable ref there is unreviewed code
 * beside the deploy credentials; `home-lang` also resolved only through a
 * rename redirect, which stops applying the moment a repository of that name
 * exists again.
 *
 * Neither file was noticed for three months because the commit that
 * introduced the convention missed one, the other was later written by
 * copying it, and the sweep that bumps the pinned version can only see files
 * that already carry a pin (stacksjs/stacks#2906).
 */
const workflowDir = new URL('../../../defaults/vcs/github/workflows/', import.meta.url)

/** Every `uses:` in a parsed workflow, wherever it sits in the document. */
function actionRefs(node: unknown, found: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const item of node) actionRefs(item, found)
    return found
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'uses' && typeof value === 'string')
        found.push(value)
      else
        actionRefs(value, found)
    }
  }
  return found
}

const workflows = readdirSync(workflowDir)
  .filter(name => name.endsWith('.yml') || name.endsWith('.yaml'))
  .map((name) => {
    const parsed = Bun.YAML.parse(readFileSync(new URL(name, workflowDir), 'utf8'))
    return { name, refs: actionRefs(parsed) }
  })

const everyRef = workflows.flatMap(({ name, refs }) => refs.map(ref => `${name}: ${ref}`))

test('the scaffolded workflows are read, not silently skipped', () => {
  // Without this the two assertions below pass on an empty list, which is how
  // a parse change or a moved directory would read as "no violations".
  expect(workflows.length).toBeGreaterThanOrEqual(5)
  expect(everyRef.length).toBeGreaterThanOrEqual(10)
})

test('no scaffolded workflow runs an action from a moving branch', () => {
  const mutable = everyRef.filter(ref => /@(?:main|master)$/.test(ref))
  expect(mutable).toEqual([])
})

test('every Pantry action in the scaffold is the same pinned commit', () => {
  const pantry = everyRef.filter(ref => ref.includes('pantry/packages/action'))
  expect(pantry.length).toBeGreaterThan(0)

  const pinned = pantry.map(ref => ref.slice(ref.indexOf(': ') + 2))
  expect([...new Set(pinned)]).toHaveLength(1)
  // A tag moves and a branch moves; only a commit is the thing that was read.
  for (const ref of pinned)
    expect(ref).toMatch(/^pantry-pm\/pantry\/packages\/action@[0-9a-f]{40}\b/)
})
