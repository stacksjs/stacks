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
import { join } from 'node:path'
import { scrubLoopbackSitePortsForFirewall } from '../src/commands/deploy'

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
})
