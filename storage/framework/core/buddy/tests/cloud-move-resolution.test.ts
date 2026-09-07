import { describe, expect, it } from 'bun:test'
import { serverServing, sitesSharingHostnames } from '../src/commands/cloud'

/**
 * A move has to know which box the site is on NOW, and config cannot say:
 * config records where a site is declared to live, which is the same as where it
 * is right up until the moment somebody needs to move it. So the boxes are
 * asked, and what matters is how the answer handles a box that cannot answer.
 */

const boxes = [
  { name: 'shop-production-app', ipv4: '1.1.1.1' },
  { name: 'shop-production-lb', ipv4: '2.2.2.2' },
]

function probing(answers: Record<string, { routes?: any[], unavailable?: string }>) {
  const asked: string[] = []
  return {
    asked,
    probe: async (server: any) => {
      asked.push(server.name)
      return answers[server.name] ?? { routes: [] }
    },
  }
}

describe('serverServing', () => {
  it('finds the box whose gateway answers for the hostname', async () => {
    const { probe } = probing({ 'shop-production-lb': { routes: [{ host: 'shop.example.com' }] } })

    const found = await serverServing(boxes, ['shop.example.com'], probe)

    expect(found?.name).toBe('shop-production-lb')
  })

  it('stops at the first box that answers, rather than probing the whole fleet', async () => {
    const { asked, probe } = probing({ 'shop-production-app': { routes: [{ host: 'shop.example.com' }] } })

    await serverServing(boxes, ['shop.example.com'], probe)

    expect(asked).toEqual(['shop-production-app'])
  })

  /**
   * The caller turns this into "pass --from to say". Treating an unreachable box
   * as a match would move the site off whichever box happened to be down.
   */
  it('does not treat a box it could not ask as the one serving the site', async () => {
    const { probe } = probing({
      'shop-production-app': { unavailable: 'ssh refused', routes: [{ host: 'shop.example.com' }] },
    })

    expect(await serverServing(boxes, ['shop.example.com'], probe)).toBeUndefined()
  })

  it('skips a box with no address instead of probing nothing', async () => {
    const { asked, probe } = probing({})

    await serverServing([{ name: 'pending', ipv4: undefined }, ...boxes], ['nope.example.com'], probe)

    expect(asked).toEqual(['shop-production-app', 'shop-production-lb'])
  })

  it('matches any of the site\'s hostnames, not only the first', async () => {
    const { probe } = probing({ 'shop-production-lb': { routes: [{ host: 'www.shop.example.com' }] } })

    const found = await serverServing(boxes, ['shop.example.com', 'www.shop.example.com'], probe)

    expect(found?.name).toBe('shop-production-lb')
  })
})

/**
 * A move repoints DNS, and DNS is per hostname rather than per site. This
 * project mounts four sites on `stacksjs.com` - `main` at `/`, `docs` at
 * `/docs`, `blog` at `/blog`, `discord` at `/discord` - so moving `docs` alone
 * would carry one tree to the target and point the whole apex there, leaving
 * the other three on a box nothing resolves to.
 *
 * ts-cloud cannot see this: it is handed one site and one hostname, and both are
 * correct in isolation. The sharing lives in the project's site model.
 */
describe('sitesSharingHostnames', () => {
  const hostsOf = (_name: string, site: any) => (site?.domain ? [String(site.domain)] : [])

  const sites = {
    main: { domain: 'shop.com', path: '/' },
    docs: { domain: 'shop.com', path: '/docs' },
    blog: { domain: 'shop.com', path: '/blog' },
    api: { domain: 'api.shop.com', path: '/' },
  }

  it('names every other site on the same hostname, with its path', () => {
    expect(sitesSharingHostnames(sites, 'docs', ['shop.com'], hostsOf)).toEqual(['blog (/blog)', 'main (/)'])
  })

  it('says nothing for a site that owns its hostname outright', () => {
    expect(sitesSharingHostnames(sites, 'api', ['api.shop.com'], hostsOf)).toEqual([])
  })

  it('never counts the site being moved as sharing with itself', () => {
    expect(sitesSharingHostnames({ only: sites.docs }, 'only', ['shop.com'], hostsOf)).toEqual([])
  })

  /** A loopback-only site has no hostname, so it cannot collide with one. */
  it('ignores sites the gateway never routes', () => {
    const withInternal = { ...sites, worker: { path: '/' } }

    expect(sitesSharingHostnames(withInternal, 'api', ['api.shop.com'], hostsOf)).toEqual([])
  })

  it('matches on any of the moving site\'s hostnames', () => {
    const wwwToo = { alt: { domain: 'www.shop.com', path: '/' }, docs: sites.docs }

    expect(sitesSharingHostnames(wwwToo, 'docs', ['shop.com', 'www.shop.com'], hostsOf)).toEqual(['alt (/)'])
  })
})
