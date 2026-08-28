import { describe, expect, it } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildHostRoutesScript,
  declaredSites,
  describeInventory,
  describeProviderFailure,
  listProviderServers,
  parseHostRoutesOutput,
  probeHostRoutes,
  reconcile,
  routesFromFragments,
  tenantsOf,
  toInventoryServer,
  unaccountedSites,
} from '../src/cloud-inventory'

/**
 * What is hosted where (stacksjs/stacks#2342).
 *
 * The trap this whole module exists to avoid: `config/cloud.ts` describes ONE
 * project, the boxes are shared, and so reading config alone reports a
 * multi-tenant server as if this project were alone on it. Every test below
 * that matters is about a co-tenant being visible, or about a partial answer
 * being labelled partial rather than passed off as a complete one.
 */

function fragment(slug: string, proxies: any[]): string {
  return Buffer.from(JSON.stringify({ slug, proxies })).toString('base64')
}

const STACKS_FRAGMENT = {
  slug: 'stacks',
  proxies: [
    { to: 'stacksjs.com', from: '127.0.0.1:3000' },
    { to: 'stacksjs.com', path: '/docs', static: { dir: '/var/www/stacks-docs', spa: false } },
    { to: 'stacksjs.com', path: '/discord', redirect: { to: 'https://discord.gg/example', preservePath: false } },
  ],
}

const RAPPID_FRAGMENT = {
  slug: 'rappid',
  proxies: [{ to: 'rappid.hq.training', from: '127.0.0.1:3024' }],
}

describe('provider server shaping', () => {
  it('resolves the ts-cloud identity a box was labelled with', () => {
    const server = toInventoryServer({
      id: 12345,
      name: 'stacks-production-app',
      status: 'running',
      public_net: { ipv4: { ip: '5.161.0.1' }, ipv6: { ip: '2a01:4f8::/64' } },
      server_type: { name: 'cpx41' },
      datacenter: { name: 'fsn1-dc14', location: { name: 'fsn1' } },
      labels: { 'ts-cloud/project': 'stacks', 'ts-cloud/environment': 'production', 'ts-cloud/role': 'app' },
    })

    expect(server).toMatchObject({
      id: '12345',
      name: 'stacks-production-app',
      status: 'running',
      ipv4: '5.161.0.1',
      type: 'cpx41',
      location: 'fsn1',
      project: 'stacks',
      environment: 'production',
      role: 'app',
    })
  })

  it('keeps an unlabelled box in the listing rather than dropping it', () => {
    // A box provisioned by hand, or by a ts-cloud old enough not to label, is
    // exactly the kind of server a consolidation needs to see. Requiring the
    // labels would hide it.
    const server = toInventoryServer({ id: 7, name: 'legacy-box', status: 'running', labels: {} })

    expect(server.project).toBeUndefined()
    expect(server.name).toBe('legacy-box')
  })
})

describe('the box registry', () => {
  it('reads every project on the box, not just ours', () => {
    const routes = routesFromFragments([STACKS_FRAGMENT, RAPPID_FRAGMENT])

    expect(routes.map(route => `${route.slug} ${route.host}${route.path}`)).toEqual([
      'rappid rappid.hq.training/',
      'stacks stacksjs.com/',
      'stacks stacksjs.com/discord',
      'stacks stacksjs.com/docs',
    ])
  })

  it('describes each route by where it actually goes', () => {
    const routes = routesFromFragments([STACKS_FRAGMENT])
    const byPath = Object.fromEntries(routes.map(route => [route.path, route]))

    expect(byPath['/']).toMatchObject({ kind: 'app', target: '127.0.0.1:3000' })
    expect(byPath['/docs']).toMatchObject({ kind: 'static', target: '/var/www/stacks-docs' })
    expect(byPath['/discord']).toMatchObject({ kind: 'redirect', target: 'https://discord.gg/example' })
  })

  it('reads a load-balanced route as its whole upstream pool', () => {
    const routes = routesFromFragments([{ slug: 'x', proxies: [{ to: 'x.com', from: ['10.0.0.1:3000', '10.0.0.2:3000'] }] }])

    expect(routes[0]).toMatchObject({ kind: 'app', target: '10.0.0.1:3000, 10.0.0.2:3000' })
  })

  it('defaults a fragment with no slug to the same owner the writer would', () => {
    // An older ts-cloud wrote fragments without `slug`; its writer defaults to
    // 'app'. Reading them as an unnamed tenant would split one project in two.
    expect(routesFromFragments([{ proxies: [{ to: 'old.example', from: '127.0.0.1:3000' }] }])[0].slug).toBe('app')
  })

  it('groups tenants biggest first so the box owner reads at the top', () => {
    expect(tenantsOf(routesFromFragments([STACKS_FRAGMENT, RAPPID_FRAGMENT])).map(t => t.slug)).toEqual(['stacks', 'rappid'])
  })
})

describe('parsing what the box printed', () => {
  it('decodes one base64 fragment per line', () => {
    const stdout = `${fragment('stacks', [{ to: 'stacksjs.com', from: '127.0.0.1:3000' }])}\n${fragment('rappid', [])}\n`

    expect(parseHostRoutesOutput(stdout).map((f: any) => f.slug)).toEqual(['stacks', 'rappid'])
  })

  it('skips a corrupt fragment instead of losing the whole listing', () => {
    // The box's own assembler tolerates a bad fragment; a listing that threw
    // would be strictly less useful than one that is short by a single file.
    const stdout = `not-base64-at-all\n${fragment('rappid', [])}\n`

    expect(parseHostRoutesOutput(stdout).map((f: any) => f.slug)).toEqual(['rappid'])
  })

  it('reads an empty box as no co-tenants rather than an error', () => {
    expect(parseHostRoutesOutput('')).toEqual([])
  })

  it('emits one line per fragment even though the files are pretty-printed', () => {
    const script = buildHostRoutesScript('/etc/rpx/sites.d')

    expect(script).toContain('/etc/rpx/sites.d')
    // base64 wraps its output; without collapsing it a single fragment would
    // parse as a dozen unrelated lines.
    expect(script).toContain("tr -d '\\n'")
    // A box that has never been deployed to has no such directory, and that
    // must read as "nothing hosted", not as a failure.
    expect(script).toContain('[ -d "$d" ] || exit 0')
  })
})

describe('the shell snippet, run for real', () => {
  /**
   * The script is the one piece that cannot be reasoned about from types: it
   * has to survive `base64` wrapping its output at 76 columns, a directory
   * that does not exist, and files it must not pick up. Running it against a
   * real shell is the only way to know, and a local bash is close enough to
   * the box's to catch the mistakes that matter.
   */
  async function run(dir: string): Promise<string> {
    const proc = Bun.spawn(['bash', '-c', buildHostRoutesScript(dir)], { stdout: 'pipe', stderr: 'pipe' })
    const stdout = await new Response(proc.stdout).text()
    await proc.exited
    return stdout
  }

  it('round-trips a pretty-printed fragment through one line of output', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'stacks-sites-d-'))
    try {
      // Pretty-printed and long enough that base64 wraps it, which is exactly
      // what broke a naive `cat` of these files.
      await writeFile(join(dir, 'stacks.json'), JSON.stringify(STACKS_FRAGMENT, null, 2))
      await writeFile(join(dir, 'rappid.json'), JSON.stringify(RAPPID_FRAGMENT, null, 2))
      await writeFile(join(dir, 'notes.txt'), 'not a fragment')

      const fragments = parseHostRoutesOutput(await run(dir))

      expect(fragments.map((f: any) => f.slug).sort()).toEqual(['rappid', 'stacks'])
      expect(routesFromFragments(fragments)).toHaveLength(4)
    }
    finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('prints nothing for a box that has never been deployed to', async () => {
    expect(await run(join(tmpdir(), 'stacks-sites-d-does-not-exist'))).toBe('')
  })
})

describe('probing a box', () => {
  const server = { id: '1', name: 'box', status: 'running', ipv4: '5.5.5.5', labels: {} }

  it('returns the routes a reachable box reports', async () => {
    const probe = await probeHostRoutes(server, async () => ({
      code: 0,
      stdout: `${fragment('stacks', [{ to: 'stacksjs.com', from: '127.0.0.1:3000' }])}\n`,
      stderr: '',
    }))

    expect(probe.unavailable).toBeUndefined()
    expect(probe.routes).toHaveLength(1)
  })

  it('reports an unreachable box instead of failing the whole listing', async () => {
    const probe = await probeHostRoutes(server, async () => {
      throw new Error('Permission denied (publickey).\nssh gave up')
    })

    expect(probe.routes).toEqual([])
    expect(probe.unavailable).toBe('Permission denied (publickey).')
  })

  it('does not ssh into a box that is powered off', async () => {
    let attempted = false
    const probe = await probeHostRoutes({ ...server, status: 'off' }, async () => {
      attempted = true
      return { code: 0, stdout: '', stderr: '' }
    })

    expect(attempted).toBe(false)
    expect(probe.unavailable).toBe('server is off')
  })

  it('surfaces the remote stderr when the command itself fails', async () => {
    const probe = await probeHostRoutes(server, async () => ({ code: 1, stdout: '', stderr: 'find: permission denied\n' }))

    expect(probe.unavailable).toBe('find: permission denied')
  })
})

describe('declared sites', () => {
  const sites = {
    main: { root: '.', domain: 'stacksjs.com', path: '/', start: 'bun serve', port: 3000 },
    api: { root: '.', start: 'bun api', port: 3008 },
    docs: { root: 'dist/docs', domain: 'stacksjs.com', path: '/docs' },
  }

  it('marks a domainless site as loopback-only rather than as missing', () => {
    // `api` is deliberately domainless: the gateway skips it and it is reached
    // through main's same-origin /api proxy. Reporting it as an undeployed
    // site would be a false alarm on every single run.
    const declared = declaredSites(sites, {}, 'stacks')

    expect(declared.find(site => site.name === 'api')?.loopbackOnly).toBe(true)
    expect(declared.find(site => site.name === 'main')?.loopbackOnly).toBe(false)
  })

  it('takes the install path from ts-cloud rather than deriving its own', () => {
    const declared = declaredSites(sites, { siteInstallBase: (slug, site) => `/var/www/${slug}-${site}` }, 'stacks')

    expect(declared.find(site => site.name === 'docs')?.installBase).toBe('/var/www/stacks-docs')
  })

  it('still lists the sites when ts-cloud could not be loaded', () => {
    const declared = declaredSites(sites)

    expect(declared).toHaveLength(3)
    expect(declared[0].installBase).toBeUndefined()
  })
})

describe('reconciling config against the box', () => {
  const declared = declaredSites(
    {
      main: { domain: 'stacksjs.com', path: '/', port: 3000, start: 'x' },
      docs: { domain: 'stacksjs.com', path: '/docs' },
      blog: { domain: 'stacksjs.com', path: '/blog' },
      api: { port: 3008, start: 'x' },
    },
    {},
    'stacks',
  )
  const routes = routesFromFragments([STACKS_FRAGMENT, RAPPID_FRAGMENT])

  it('separates present, absent, loopback and somebody else entirely', () => {
    const result = reconcile(declared, routes, 'stacks')

    expect(result.present.map(site => site.name).sort()).toEqual(['docs', 'main'])
    expect(result.absent.map(site => site.name)).toEqual(['blog'])
    expect(result.loopback.map(site => site.name)).toEqual(['api'])
    expect(result.foreign.map(route => route.slug)).toEqual(['rappid'])
  })

  it('matches on host and path, not on the site key', () => {
    // The box has no idea what a repository calls its sites, and two projects
    // both naming one `main` is normal. Keying on the name would match routes
    // across projects.
    const result = reconcile(
      declaredSites({ frontend: { domain: 'stacksjs.com', path: '/' } }, {}, 'stacks'),
      routes,
      'stacks',
    )

    expect(result.present.map(site => site.name)).toEqual(['frontend'])
  })

  it('does not credit our site to another project serving the same host', () => {
    const result = reconcile(
      declaredSites({ main: { domain: 'rappid.hq.training', path: '/' } }, {}, 'stacks'),
      routes,
      'stacks',
    )

    expect(result.present).toEqual([])
    expect(result.absent.map(site => site.name)).toEqual(['main'])
  })

  it('ignores a trailing slash on a path prefix', () => {
    const result = reconcile(declaredSites({ docs: { domain: 'stacksjs.com', path: '/docs/' } }, {}, 'stacks'), routes, 'stacks')

    expect(result.present.map(site => site.name)).toEqual(['docs'])
  })
})

describe('sites unaccounted for across the whole fleet', () => {
  const declared = declaredSites(
    { main: { domain: 'stacksjs.com', path: '/' }, blog: { domain: 'blog.example', path: '/' }, api: { port: 3008 } },
    {},
    'stacks',
  )

  it('only counts a site missing when no probed box serves it', () => {
    const probes = [
      { server: 'a', routes: routesFromFragments([STACKS_FRAGMENT]) },
      { server: 'b', routes: routesFromFragments([RAPPID_FRAGMENT]) },
    ]

    expect(unaccountedSites(declared, probes, 'stacks').map(site => site.name)).toEqual(['blog'])
  })

  it('never counts a loopback-only site as missing', () => {
    expect(unaccountedSites(declared, [], 'stacks').map(site => site.name)).toEqual(['main', 'blog'])
  })
})

describe('the listing an operator reads', () => {
  const servers = [
    toInventoryServer({
      id: 1,
      name: 'stacks-production-app',
      status: 'running',
      public_net: { ipv4: { ip: '5.161.0.1' } },
      server_type: { name: 'cpx41' },
      datacenter: { location: { name: 'fsn1' } },
      labels: { 'ts-cloud/project': 'stacks', 'ts-cloud/environment': 'production', 'ts-cloud/role': 'app' },
    }),
  ]

  const declared = declaredSites(
    { main: { domain: 'stacksjs.com', path: '/' }, blog: { domain: 'blog.example', path: '/' }, api: { port: 3008 } },
    {},
    'stacks',
  )

  it('names the co-tenant sharing the box', () => {
    const output = describeInventory({
      slug: 'stacks',
      environment: 'production',
      servers,
      probes: [{ server: 'stacks-production-app', ip: '5.161.0.1', routes: routesFromFragments([STACKS_FRAGMENT, RAPPID_FRAGMENT]) }],
      declared,
    }).join('\n')

    expect(output).toContain('serves 4 routes for 2 projects')
    expect(output).toContain('stacks (this project)')
    expect(output).toContain('rappid')
    expect(output).toContain('rappid.hq.training/  ->  127.0.0.1:3024')
  })

  it('says a box was not probed rather than implying it hosts nothing', () => {
    const output = describeInventory({
      slug: 'stacks',
      environment: 'production',
      servers,
      probes: [],
      declared,
    }).join('\n')

    expect(output).toContain('not probed (--no-remote)')
    expect(output).toContain('Nothing to reconcile them against')
  })

  it('says why a box could not be read, and refuses to reconcile against nothing', () => {
    // The distinction that keeps this listing honest: unreachable is not the
    // same claim as undeployed. With no box answering, every routable site
    // would otherwise be reported missing - a true statement about the
    // listing and a false one about the deployment.
    const output = describeInventory({
      slug: 'stacks',
      environment: 'production',
      servers,
      probes: [{ server: 'stacks-production-app', ip: '5.161.0.1', routes: [], unavailable: 'Permission denied (publickey).' }],
      declared,
    }).join('\n')

    expect(output).toContain('could not read /etc/rpx/sites.d: Permission denied (publickey).')
    expect(output).toContain('Nothing to reconcile them against')
    expect(output).not.toContain('not routed by any box above')
  })

  it('blames an unreadable box before it blames the deploy', () => {
    const output = describeInventory({
      slug: 'stacks',
      environment: 'production',
      servers: [...servers, toInventoryServer({ id: 2, name: 'other', status: 'running', labels: {} })],
      probes: [
        { server: 'stacks-production-app', routes: routesFromFragments([STACKS_FRAGMENT]) },
        { server: 'other', routes: [], unavailable: 'Permission denied (publickey).' },
      ],
      declared,
    }).join('\n')

    expect(output).toContain('1 not routed by any box above: blog')
    expect(output).toContain('one of the 1 server that could not be read')
  })

  it('points at the boxes it skipped when the run stayed local', () => {
    const output = describeInventory({
      slug: 'stacks',
      environment: 'production',
      servers: [...servers, toInventoryServer({ id: 2, name: 'other', status: 'running', labels: {} })],
      probes: [{ server: 'stacks-production-app', routes: routesFromFragments([STACKS_FRAGMENT]) }],
      declared,
    }).join('\n')

    expect(output).toContain('one of the 1 server this run did not probe')
  })

  it('explains a domainless site instead of listing it as missing', () => {
    const output = describeInventory({
      slug: 'stacks',
      environment: 'production',
      servers,
      probes: [{ server: 'stacks-production-app', routes: routesFromFragments([STACKS_FRAGMENT]) }],
      declared,
    }).join('\n')

    expect(output).toContain('1 with no domain')
    expect(output).toContain('1 not routed by any box above: blog')
  })

  it('leads with the provider failure when the fleet could not be listed', () => {
    const output = describeInventory({
      slug: 'stacks',
      environment: 'production',
      servers: [],
      probes: [],
      declared,
      providerFailure: { kind: 'no-token' },
    }).join('\n')

    expect(output.startsWith('No Hetzner API token')).toBe(true)
    expect(output).toContain('No servers found.')
  })
})

describe('provider failures', () => {
  it('tells a missing token apart from an empty project', () => {
    expect(describeProviderFailure({ kind: 'no-token' })).toContain('HCLOUD_TOKEN')
  })

  it('calls a 401 an auth failure rather than an empty fleet', () => {
    // The deploy command learned this one the hard way: a token problem and a
    // genuinely empty project used to print the same sentence.
    expect(describeProviderFailure({ kind: 'request-failed', status: 401 })).toContain('auth failure')
  })

  it('says a network error left the answer unknown', () => {
    expect(describeProviderFailure({ kind: 'request-failed', status: 0 })).toContain('could not be reached')
  })
})

describe('listing the fleet', () => {
  it('does not call the API without a token', async () => {
    let called = false
    const listing = await listProviderServers(undefined, (async () => {
      called = true
      return new Response('{}')
    }) as unknown as typeof fetch)

    expect(called).toBe(false)
    expect(listing.failure).toEqual({ kind: 'no-token' })
  })

  it('follows pagination so a large fleet is not silently truncated', async () => {
    const pages: Record<string, any> = {
      '1': { servers: [{ id: 1, name: 'b', labels: {} }], meta: { pagination: { next_page: 2 } } },
      '2': { servers: [{ id: 2, name: 'a', labels: {} }], meta: { pagination: { next_page: null } } },
    }
    const listing = await listProviderServers('token', (async (url: string) => {
      const page = new URL(url).searchParams.get('page') as string
      return new Response(JSON.stringify(pages[page]))
    }) as unknown as typeof fetch)

    expect(listing.servers.map(server => server.name)).toEqual(['a', 'b'])
  })

  it('reports an HTTP failure instead of returning an empty fleet', async () => {
    const listing = await listProviderServers('token', (async () =>
      new Response('unauthorized', { status: 401 })) as unknown as typeof fetch)

    expect(listing.servers).toEqual([])
    expect(listing.failure).toMatchObject({ kind: 'request-failed', status: 401 })
  })

  it('keeps the servers it did read when a later page fails', async () => {
    let call = 0
    const listing = await listProviderServers('token', (async () => {
      call += 1
      if (call === 1)
        return new Response(JSON.stringify({ servers: [{ id: 1, name: 'a', labels: {} }], meta: { pagination: { next_page: 2 } } }))
      throw new Error('socket hang up')
    }) as unknown as typeof fetch)

    expect(listing.servers.map(server => server.name)).toEqual(['a'])
    expect(listing.failure).toMatchObject({ kind: 'request-failed', status: 0 })
  })
})
