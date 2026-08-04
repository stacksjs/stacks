/**
 * Regression coverage for stacksjs/stacks#1950 (firewall scoping).
 *
 * ts-cloud's Hetzner provisioning opens EVERY numeric `site.port` to
 * 0.0.0.0/0 + ::/0 (HetznerDriver.collectUpstreamPorts →
 * buildHetznerFirewallRules), so declaring `port: 3008` on the
 * loopback-bound `api` site internet-exposed the port and left only the
 * HOST=127.0.0.1 process bind between the public internet and the full
 * bun-router API (auth, ORM auto-CRUD, commerce). The Hetzner deploy now
 * provisions with `scrubLoopbackSitePortsForFirewall(config)`, which strips
 * `port` from loopback-bound, domain-less server-app sites — while the
 * unmodified config still drives deployAllComputeSites, keeping the systemd
 * unit's `Environment=PORT` intact.
 */

import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  loadTsCloudDeployApi,
  reconcilePartialDeployManagementDashboards,
  resolveProjectTsCloudModule,
  resolvePersistedAttachTargetBox,
  scrubLoopbackSitePortsForFirewall,
  shouldInjectManagementDashboard,
} from '../src/commands/deploy'

/**
 * Mirror of ts-cloud's HetznerDriver.collectUpstreamPorts — the exact set of
 * ports buildHetznerFirewallRules opens to the internet (beyond 80/443/22).
 */
function collectUpstreamPorts(sites: Record<string, any>): number[] {
  const ports = new Set<number>()
  for (const site of Object.values(sites)) {
    if (typeof site?.port === 'number')
      ports.add(site.port)
  }
  return [...ports].filter(port => ![80, 443].includes(port))
}

describe('scrubLoopbackSitePortsForFirewall (#1950)', () => {
  it('strips the port of a loopback-bound, domain-less server-app site', () => {
    const config = {
      sites: {
        main: { root: '.', domain: 'example.com', start: 'bun serve', port: 3000 },
        api: { root: '.', start: 'bun api', port: 3008, env: { HOST: '127.0.0.1' } },
      },
    }
    const scrubbed = scrubLoopbackSitePortsForFirewall(config)
    expect(collectUpstreamPorts(scrubbed.sites)).toEqual([3000])
    expect(scrubbed.sites.api.port).toBeUndefined()
  })

  it('keeps the port when the site has a domain (rpx gateway needs it for its route table)', () => {
    const config = {
      sites: {
        admin: { root: '.', domain: 'admin.example.com', start: 'bun admin', port: 3010, env: { HOST: '127.0.0.1' } },
      },
    }
    const scrubbed = scrubLoopbackSitePortsForFirewall(config)
    expect(collectUpstreamPorts(scrubbed.sites)).toEqual([3010])
  })

  it('keeps the port when HOST is not loopback (the service intends direct exposure)', () => {
    const config = {
      sites: {
        api: { root: '.', start: 'bun api', port: 3008, env: { HOST: '0.0.0.0' } },
        worker: { root: '.', start: 'bun worker', port: 3020 },
      },
    }
    const scrubbed = scrubLoopbackSitePortsForFirewall(config)
    expect(collectUpstreamPorts(scrubbed.sites).sort()).toEqual([3008, 3020])
  })

  it('treats ::1 and localhost as loopback too', () => {
    const config = {
      sites: {
        a: { root: '.', start: 'bun a', port: 4001, env: { HOST: '::1' } },
        b: { root: '.', start: 'bun b', port: 4002, env: { HOST: 'LOCALHOST' } },
      },
    }
    const scrubbed = scrubLoopbackSitePortsForFirewall(config)
    expect(collectUpstreamPorts(scrubbed.sites)).toEqual([])
  })

  it('does not mutate the input config (deployAllComputeSites still needs the port for Environment=PORT)', () => {
    const config = {
      sites: {
        api: { root: '.', start: 'bun api', port: 3008, env: { HOST: '127.0.0.1' } },
      },
    }
    const scrubbed = scrubLoopbackSitePortsForFirewall(config)
    expect(scrubbed).not.toBe(config)
    expect(config.sites.api.port).toBe(3008)
  })

  it('passes a config without sites through untouched', () => {
    const config = { project: { slug: 'x' } }
    expect(scrubLoopbackSitePortsForFirewall(config)).toBe(config)
  })

  it('shipped config: the api site port stays out of the Hetzner firewall', async () => {
    // Pins the pairing between config/cloud.ts (api: loopback HOST, no
    // domain, port 3008) and the deploy-time scrub — if either side drifts
    // (e.g. the api site grows a domain or loses its loopback HOST), this
    // surfaces the renewed internet exposure.
    const { tsCloud } = await import(join(import.meta.dir, '../../../../..', 'config/cloud.ts'))
    const ports = collectUpstreamPorts(scrubLoopbackSitePortsForFirewall(tsCloud).sites)
    expect(ports).toContain(3000)
    expect(ports).not.toContain(3008)
  })

  it('shipped config: the production api keeps one external router instance', async () => {
    const { tsCloud } = await import(join(import.meta.dir, '../../../../..', 'config/cloud.ts'))
    const apiBuild = tsCloud.sites.api.preStart.find((command: string) => command.includes('serve/api.ts'))
    expect(apiBuild).toContain('--production')
    expect(apiBuild).toContain('--external=@stacksjs/router')
    expect(apiBuild).not.toContain('--splitting')
  })
})

describe('reconcilePartialDeployManagementDashboards', () => {
  it('pins a narrowed deploy to the port of the active dashboard unit', () => {
    const config = {
      sites: {
        main: { domain: 'stacksjs.com', port: 3000 },
        'dashboard-stacksjs-com': {
          domain: 'dashboard.stacksjs.com',
          port: 29446,
          start: 'bun dashboard-server.js --box --port 29446',
        },
      },
    }

    const result = reconcilePartialDeployManagementDashboards(config, {
      'dashboard-stacksjs-com': 29346,
    })

    expect(result).toEqual({ preserved: ['dashboard-stacksjs-com'], removed: [] })
    expect(config.sites['dashboard-stacksjs-com'].port).toBe(29346)
    expect(config.sites['dashboard-stacksjs-com'].start).toContain('--port 29346')
    expect(config.sites.main.port).toBe(3000)
  })

  it('omits a dashboard route when no active service owns it', () => {
    const config: any = {
      sites: {
        main: { domain: 'stacksjs.com', port: 3000 },
        'dashboard-stacksjs-com': {
          domain: 'dashboard.stacksjs.com',
          port: 29446,
          start: 'bun dashboard-server.js --box --port 29446',
        },
      },
    }

    const result = reconcilePartialDeployManagementDashboards(config, {})

    expect(result).toEqual({ preserved: [], removed: ['dashboard-stacksjs-com'] })
    expect(config.sites['dashboard-stacksjs-com']).toBeUndefined()
    expect(config.sites.main.port).toBe(3000)
  })
})

describe('management dashboard ownership', () => {
  it('injects a dashboard only for the project that owns the server', () => {
    expect(shouldInjectManagementDashboard({ cloud: { provider: 'hetzner' } })).toBe(true)
    expect(shouldInjectManagementDashboard({ cloud: { provider: 'hetzner', attachTo: 'stacks' } })).toBe(false)
  })
})

describe('attached compute state', () => {
  it('reuses a complete tenant state pin without provider credentials', () => {
    const fixtureDir = mkdtempSync(join(tmpdir(), 'attached-compute-'))
    const stateDir = join(fixtureDir, 'storage', 'cloud', 'state')
    mkdirSync(stateDir, { recursive: true })
    writeFileSync(join(stateDir, 'tenant-production.json'), JSON.stringify({
      stackName: 'tenant-production',
      serverId: 133793977,
      serverName: 'stacks-production-app',
      publicIp: '203.0.113.10',
      publicIpv6: '2001:db8::10',
    }))

    try {
      expect(resolvePersistedAttachTargetBox({
        project: { slug: 'tenant' },
        cloud: { provider: 'hetzner', attachTo: 'stacks' },
      }, 'production', fixtureDir)).toEqual({
        serverId: 133793977,
        serverName: 'stacks-production-app',
        publicIp: '203.0.113.10',
        publicIpv6: '2001:db8::10',
      })
    }
    finally {
      rmSync(fixtureDir, { force: true, recursive: true })
    }
  })

  it('rejects stale or incomplete tenant state', () => {
    const fixtureDir = mkdtempSync(join(tmpdir(), 'attached-compute-'))
    const stateDir = join(fixtureDir, 'storage', 'cloud', 'state')
    mkdirSync(stateDir, { recursive: true })
    writeFileSync(join(stateDir, 'tenant-production.json'), JSON.stringify({
      stackName: 'another-production',
      serverId: 133793977,
      publicIp: '203.0.113.10',
    }))

    try {
      expect(resolvePersistedAttachTargetBox({
        project: { slug: 'tenant' },
        cloud: { provider: 'hetzner', attachTo: 'stacks' },
      }, 'production', fixtureDir)).toBeNull()
    }
    finally {
      rmSync(fixtureDir, { force: true, recursive: true })
    }
  })
})

describe('loadTsCloudDeployApi', () => {
  it('resolves the application dependency before a nested Buddy copy', () => {
    const fixtureDir = mkdtempSync(join(tmpdir(), 'ts-cloud-project-'))
    const packageDir = join(fixtureDir, 'node_modules', '@stacksjs', 'ts-cloud')
    const modulePath = join(packageDir, 'dist', 'index.js')
    mkdirSync(join(packageDir, 'dist'), { recursive: true })
    writeFileSync(join(packageDir, 'package.json'), JSON.stringify({
      exports: { '.': { import: './dist/index.js' } },
    }))
    writeFileSync(modulePath, 'export function createCloudDriver() {}')

    try {
      expect(resolveProjectTsCloudModule(fixtureDir)).toBe(modulePath)
    }
    finally {
      rmSync(fixtureDir, { force: true, recursive: true })
    }
  })

  it('loads an explicit built module for local ts-cloud dogfooding', async () => {
    const fixtureDir = mkdtempSync(join(tmpdir(), 'ts-cloud-module-'))
    const modulePath = join(fixtureDir, 'index.mjs')
    const previous = process.env.TS_CLOUD_MODULE
    writeFileSync(modulePath, [
      'export function createCloudDriver() {}',
      'export function deployAllComputeSites() {}',
      'export function ensureManagementDashboard() {}',
      'export function resolveSiteKind() {}',
    ].join('\n'))
    process.env.TS_CLOUD_MODULE = modulePath

    try {
      const api = await loadTsCloudDeployApi()
      expect(typeof api.createCloudDriver).toBe('function')
      expect(typeof api.deployAllComputeSites).toBe('function')
      expect(typeof api.ensureManagementDashboard).toBe('function')
      expect(typeof api.resolveSiteKind).toBe('function')
    } finally {
      if (previous === undefined) delete process.env.TS_CLOUD_MODULE
      else process.env.TS_CLOUD_MODULE = previous
      rmSync(fixtureDir, { force: true, recursive: true })
    }
  })
})
