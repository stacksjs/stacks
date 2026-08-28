import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  attachConflicts,
  attachPreconditions,
  describeAttachPlan,
  parseUpstreamPort,
  portOwners,
  resolveAttachTarget,
  setAttachTo,
} from '../src/cloud-attach'
import { declaredSites, routesFromFragments, toInventoryServer } from '../src/cloud-inventory'

/**
 * Attaching a project to somebody else's box.
 *
 * The failure this is built around is not hypothetical: two services on one
 * port do not error, because ts-cloud's units do not bind exclusively. The
 * kernel load-balances between them, both look healthy, and each domain serves
 * the other project's site about half the time. predicthq.org spent a day and
 * a half like that. Every check here exists to catch that before a deploy
 * rather than during one.
 */

function server(overrides: Record<string, any> = {}): any {
  return toInventoryServer({
    id: 1,
    name: 'stacks-production-app',
    status: 'running',
    public_net: { ipv4: { ip: '5.161.0.1' } },
    labels: { 'ts-cloud/project': 'stacks', 'ts-cloud/environment': 'production', 'ts-cloud/role': 'app' },
    ...overrides,
  })
}

const BOX_ROUTES = routesFromFragments([
  {
    slug: 'stacks',
    proxies: [
      { to: 'stacksjs.com', from: '127.0.0.1:3000' },
      { to: 'stacksjs.com', path: '/docs', static: { dir: '/var/www/stacks-docs' } },
    ],
  },
  { slug: 'rappid', proxies: [{ to: 'rappid.hq.training', from: '127.0.0.1:3024' }] },
])

describe('picking the server to attach to', () => {
  const servers = [
    server(),
    toInventoryServer({ id: 2, name: 'stacks-staging-app', status: 'running', labels: { 'ts-cloud/project': 'stacks', 'ts-cloud/environment': 'staging' } }),
    toInventoryServer({ id: 3, name: 'bughq-production-app', status: 'running', labels: { 'ts-cloud/project': 'bughq' } }),
  ]

  it('accepts the provider name an operator reads off the console', () => {
    expect(resolveAttachTarget(servers, 'bughq-production-app')).toMatchObject({ server: { name: 'bughq-production-app' } })
  })

  it('accepts the owner slug that `attachTo` actually takes', () => {
    // The two spellings are what the operator has in front of them, and making
    // them translate between the console and the config is how the wrong box
    // gets named.
    expect(resolveAttachTarget(servers, 'bughq')).toMatchObject({ server: { name: 'bughq-production-app' } })
  })

  it('refuses rather than guessing when one owner has several boxes', () => {
    expect(resolveAttachTarget(servers, 'stacks')).toMatchObject({
      problem: expect.stringContaining('owns 2 servers'),
    })
  })

  it('narrows several boxes by environment when one is given', () => {
    expect(resolveAttachTarget(servers, 'stacks', 'staging')).toMatchObject({ server: { name: 'stacks-staging-app' } })
  })

  it('says where to look when nothing matched', () => {
    expect(resolveAttachTarget(servers, 'nope')).toMatchObject({
      problem: expect.stringContaining('ts-cloud/project=nope'),
    })
  })

  it('treats an empty --server as a missing argument, not as a search', () => {
    expect(resolveAttachTarget(servers, '  ')).toMatchObject({ problem: expect.stringContaining('No server named') })
  })
})

describe('preconditions', () => {
  it('refuses a box ts-cloud does not manage', () => {
    const problems = attachPreconditions('rappid', toInventoryServer({ id: 9, name: 'hand-rolled', status: 'running', public_net: { ipv4: { ip: '1.1.1.1' } }, labels: {} }))

    expect(problems[0]).toContain('no ts-cloud/project label')
  })

  it('refuses a tenant whose slug is the box owner\'s', () => {
    // The deploy refuses this too, but only once it is running. A tenant deploy
    // owns /etc/rpx/sites.d/<slug>.json, so sharing the owner's slug overwrites
    // the owner's own gateway fragment and takes its sites down.
    expect(attachPreconditions('stacks', server())[0]).toContain("also the slug that owns")
  })

  it('refuses a box that is not running, because nothing can be checked against it', () => {
    expect(attachPreconditions('rappid', server({ status: 'off' }))[0]).toContain('is off')
  })

  it('passes a healthy box owned by somebody else', () => {
    expect(attachPreconditions('rappid', server())).toEqual([])
  })
})

describe('reading ports off the box', () => {
  it('takes the port from an ordinary upstream', () => {
    expect(parseUpstreamPort('127.0.0.1:3000')).toBe(3000)
  })

  it('splits a bracketed IPv6 literal on the last colon', () => {
    expect(parseUpstreamPort('[::1]:3022')).toBe(3022)
  })

  it('yields nothing for something that is not a port', () => {
    expect(parseUpstreamPort('/var/www/docs')).toBeUndefined()
    expect(parseUpstreamPort('127.0.0.1:not-a-port')).toBeUndefined()
    expect(parseUpstreamPort('127.0.0.1:99999')).toBeUndefined()
  })

  it('maps each port to the project holding it', () => {
    // Ordered by how routesFromFragments sorts (slug first), not by port.
    expect([...portOwners(BOX_ROUTES)]).toEqual([[3024, 'rappid'], [3000, 'stacks']])
  })

  it('ignores our own fragment, so a re-attach does not conflict with itself', () => {
    // Every repeat run finds its own fragment already on the box from the last
    // deploy. Counting it would make the second attach impossible.
    expect([...portOwners(BOX_ROUTES, 'stacks')]).toEqual([[3024, 'rappid']])
  })

  it('reads no port from a static or redirect route', () => {
    // Their targets are paths and URLs, and `https://x.com/y` has a colon in it.
    const routes = routesFromFragments([{
      slug: 'x',
      proxies: [
        { to: 'a.com', static: { dir: '/var/www/a' } },
        { to: 'b.com', redirect: { to: 'https://example.com/z' } },
      ],
    }])

    expect(portOwners(routes).size).toBe(0)
  })

  it('reads every upstream of a load-balanced route', () => {
    const routes = routesFromFragments([{ slug: 'x', proxies: [{ to: 'x.com', from: ['10.0.0.1:3000', '10.0.0.2:3001'] }] }])

    expect([...portOwners(routes)]).toEqual([[3000, 'x'], [3001, 'x']])
  })
})

describe('conflicts with what the box already serves', () => {
  const declared = declaredSites(
    {
      main: { domain: 'rappid.hq.training', path: '/', port: 3000, start: 'x' },
      api: { port: 3008, start: 'x' },
    },
    {},
    'rappid',
  )

  it('catches the port clash that does not error on its own', () => {
    const conflicts = attachConflicts('rappid', declared, BOX_ROUTES)

    expect(conflicts).toContainEqual({ kind: 'port', site: 'main', detail: 'port 3000', heldBy: 'stacks' })
  })

  it('catches a hostname already served by another project', () => {
    const conflicts = attachConflicts('newproject', declaredSites({ main: { domain: 'stacksjs.com', path: '/docs' } }, {}, 'newproject'), BOX_ROUTES)

    expect(conflicts).toContainEqual({ kind: 'route', site: 'main', detail: 'stacksjs.com/docs', heldBy: 'stacks' })
  })

  it('does not report a free port as taken', () => {
    expect(attachConflicts('rappid', declaredSites({ api: { port: 3099, start: 'x' } }, {}, 'rappid'), BOX_ROUTES)).toEqual([])
  })

  it('does not count our own routes against us', () => {
    const ours = declaredSites({ main: { domain: 'rappid.hq.training', path: '/', port: 3024, start: 'x' } }, {}, 'rappid')

    expect(attachConflicts('rappid', ours, BOX_ROUTES)).toEqual([])
  })
})

describe('editing config/cloud.ts', () => {
  const SCAFFOLD = readFileSync(
    join(import.meta.dir, '../../../defaults/scaffold/config/cloud.ts'),
    'utf8',
  )

  it('adds attachTo to the shape every new app is scaffolded with', () => {
    // Read from the real template rather than a hand-written fixture: a
    // fixture that drifts from the scaffold would pass while the tool broke.
    const result = setAttachTo(SCAFFOLD, 'stacks') as { text: string, changed: boolean }

    expect(result.changed).toBe(true)
    expect(result.text).toContain("attachTo: 'stacks',")
    expect(result.text).toContain("provider: 'hetzner',")

    // Nothing else moved: strip the two lines it added and the original file
    // comes back byte for byte, so a config full of comments and unrelated
    // blocks cannot be quietly reflowed by this edit.
    const ADDED = [
      "    // Deploy onto the box 'stacks' owns rather than provisioning one.",
      "    attachTo: 'stacks',",
    ]
    const kept = result.text.split('\n')
    for (const line of ADDED) {
      const at = kept.indexOf(line)
      expect(at).toBeGreaterThan(-1)
      kept.splice(at, 1)
    }
    expect(kept.join('\n')).toBe(SCAFFOLD)
  })

  it('is a no-op when it already attaches to that owner', () => {
    const once = setAttachTo(SCAFFOLD, 'stacks') as { text: string }
    const twice = setAttachTo(once.text, 'stacks')

    expect(twice).toEqual({ text: once.text, changed: false })
  })

  it('repoints an existing attachTo at a different owner', () => {
    const once = setAttachTo(SCAFFOLD, 'stacks') as { text: string }
    const moved = setAttachTo(once.text, 'bughq') as { text: string, changed: boolean }

    expect(moved.changed).toBe(true)
    expect(moved.text).toContain("attachTo: 'bughq',")
    expect(moved.text).not.toContain("attachTo: 'stacks',")
  })

  it('refuses a cloud block holding a nested object rather than guessing', () => {
    const config = `export const tsCloud = {\n  cloud: {\n    provider: 'hetzner',\n    hetzner: { location: 'fsn1' },\n  },\n}\n`

    expect(setAttachTo(config, 'stacks')).toMatchObject({ problem: expect.stringContaining('nested object') })
  })

  it('refuses when there is more than one cloud block', () => {
    const config = `const a = {\n  cloud: {\n    provider: 'hetzner',\n  },\n}\nconst b = {\n  cloud: {\n    provider: 'aws',\n  },\n}\n`

    expect(setAttachTo(config, 'stacks')).toMatchObject({ problem: expect.stringContaining('2 `cloud:') })
  })

  it('refuses when there is no cloud block at all', () => {
    expect(setAttachTo('export const tsCloud = {}\n', 'stacks')).toMatchObject({ problem: expect.stringContaining('No `cloud:') })
  })

  it('leaves the file alone in every refusal', () => {
    // The point of refusing is that the file survives. A "clever" edit that
    // half-works is worse than one that never ran.
    const config = `export const tsCloud = {\n  cloud: {\n    provider: 'hetzner',\n    hetzner: { location: 'fsn1' },\n  },\n}\n`
    const result = setAttachTo(config, 'stacks')

    expect('text' in result).toBe(false)
  })
})

describe('the plan an operator reads', () => {
  const declared = declaredSites(
    { main: { domain: 'rappid.hq.training', path: '/', port: 3024, start: 'x' }, api: { port: 3008, start: 'x' } },
    { siteInstallBase: (slug, site) => `/var/www/${slug}-${site}` },
    'rappid',
  )

  function plan(overrides: Record<string, any> = {}): any {
    return {
      slug: 'rappid',
      owner: 'stacks',
      server: server(),
      declared,
      conflicts: [],
      registryRead: true,
      edit: { text: '', changed: true },
      dryRun: false,
      ...overrides,
    }
  }

  it('always names the edit it cannot make, in the other repository', () => {
    const output = describeAttachPlan(plan()).join('\n')

    expect(output).toContain("add 'rappid' to the `tenants` array")
    expect(output).toContain('RAPPID_* keys')
  })

  it('does not describe config edits when the attach is refused', () => {
    // "Two edits make the attach real" printed under a conflict list reads as
    // though it is going ahead anyway.
    const output = describeAttachPlan(plan({
      conflicts: [{ kind: 'port', site: 'main', detail: 'port 3000', heldBy: 'stacks' }],
      edit: undefined,
    })).join('\n')

    expect(output).not.toContain('Two edits make the attach real')
    expect(output).toContain('then re-run')
  })

  it('will not claim there are no conflicts when the box was never read', () => {
    // "No conflicts" after failing to ask is the single most dangerous thing
    // this command could print.
    const output = describeAttachPlan(plan({ registryRead: false, registryProblem: 'Permission denied (publickey).' })).join('\n')

    expect(output).toContain('UNCHECKED')
    expect(output).toContain('Permission denied (publickey).')
    expect(output).not.toContain('No conflicts')
  })

  it('explains why a port clash is not a loud failure', () => {
    const output = describeAttachPlan(plan({ conflicts: [{ kind: 'port', site: 'main', detail: 'port 3000', heldBy: 'stacks' }] })).join('\n')

    expect(output).toContain("site 'main' wants port 3000, held by 'stacks'")
    expect(output).toContain('the kernel load-balances')
  })

  it('says the config was not written on a dry run', () => {
    expect(describeAttachPlan(plan({ dryRun: true })).join('\n')).toContain('--dry-run, not written')
  })

  it('shows loopback-only sites as such rather than inventing a hostname', () => {
    expect(describeAttachPlan(plan()).join('\n')).toContain('api  loopback only on :3008')
  })
})
