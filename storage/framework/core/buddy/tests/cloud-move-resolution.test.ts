import { describe, expect, it } from 'bun:test'
import { serverServing } from '../src/commands/cloud'

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
