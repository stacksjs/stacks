import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { unlinkSync, writeFileSync } from 'node:fs'
import { appPath } from '@stacksjs/path'
import { clearMiddlewareCache, clearRouteMiddlewareRegistry, createStacksRouter } from '../src/stacks-router'

const fixtureName = `TimingFixture${crypto.randomUUID().replaceAll('-', '')}`
const fixtureFile = appPath(`Middleware/${fixtureName}.ts`)
let aliases: Record<string, string>

beforeAll(async () => {
  aliases = (await import(appPath('Middleware.ts'))).default
  aliases.__timing = fixtureName
  writeFileSync(fixtureFile, `
import { HttpError } from '@stacksjs/error-handling'
export default {
  handle(request) {
    if (request.params.outcome === 'response')
      throw new Response('short circuit', { status: 409 })
    if (request.params.outcome === 'error')
      throw new HttpError(418, 'timed rejection')
  },
}
`)
  clearMiddlewareCache()
})

beforeEach(() => {
  clearRouteMiddlewareRegistry()
})

afterAll(() => {
  delete aliases.__timing
  unlinkSync(fixtureFile)
  clearMiddlewareCache()
  clearRouteMiddlewareRegistry()
})

describe('middleware timing labels', () => {
  test('formats total-only and multiple middleware timings in execution order', async () => {
    const router = createStacksRouter()
    router.get('/timed/plain', () => new Response('handled'))
    router.get('/timed/chain', () => new Response('handled')).middleware(['__timing:first', '__timing:second'])

    for (const [path, labels] of [
      ['plain', ['total']],
      ['chain', ['total', 'mw___timing_first', 'mw___timing_second']],
    ] as const) {
      const request = new Request(`http://localhost/timed/${path}`)
      Object.assign(request, { _startNs: process.hrtime.bigint() })
      const response = await router.handleRequest(request)
      expect(response.status).toBe(200)
      const timings = response.headers.get('server-timing')!.split(', ')
      expect(timings.map(timing => timing.split(';')[0])).toEqual([...labels])
      for (const timing of timings)
        expect(timing).toMatch(/;dur=\d+\.\d$/)
      expect(await response.text()).toBe('handled')
    }
  })

  for (const [reference, label] of [
    ['__timing:alpha/beta', 'mw___timing_alpha_beta'],
    ['__timing:abcdefghijklmnopqrstuvwxyz0123456789', 'mw___timing_abcdefghijklmnopqrstuvw'],
    ['!__timing:alpha/beta', 'mw____timing_alpha_beta'],
  ] as const) {
    test(`preserves ${reference} on success and rejection after warming and reload`, async () => {
      const router = createStacksRouter()
      router.get('/timed/{outcome}', () => new Response('handled')).middleware(reference)

      for (let cycle = 0; cycle < 2; cycle++) {
        clearMiddlewareCache()
        for (let repetition = 0; repetition < 2; repetition++) {
          for (const outcome of ['success', 'error', 'response']) {
            const request = new Request(`http://localhost/timed/${outcome}`)
            // The API entry point stamps this before dispatching to the router.
            Object.assign(request, { _startNs: process.hrtime.bigint() })
            const response = await router.handleRequest(request)
            const negated = reference.startsWith('!')
            expect(response.status).toBe(negated
              ? (outcome === 'success' ? 403 : 200)
              : (outcome === 'success' ? 200 : outcome === 'error' ? 418 : 409))
            const timings = response.headers.get('server-timing')!.split(', ')
            expect(timings.map(timing => timing.split(';')[0])).toEqual(['total', label])
            for (const timing of timings)
              expect(timing).toMatch(/;dur=\d+\.\d$/)
            if (!negated && outcome === 'response')
              expect(await response.text()).toBe('short circuit')
            else
              await response.arrayBuffer()
          }
        }
      }
    })
  }
})
