import { expect, test } from 'bun:test'
import { mountNativeSupport } from '../src/browser'
import type { BrowserBootOptions } from '../src/browser'

test('native layout bridge authenticates server-side, clears identity before switches and ignores late results', async () => {
  const events = new EventTarget(), boots: BrowserBootOptions[] = []
  let shutdowns = 0, requests = 0, authenticated = true, release: (() => void) | undefined, wait = false
  const mount = mountNativeSupport({} as HTMLElement, {
    events, getToken: () => 'native-bearer',
    fetch: async (input, init) => {
      requests++
      expect(init?.credentials).toBe('same-origin')
      if (input.endsWith('/config')) return Response.json({ enabled: true, project: 'project', endpoint: 'https://hq.support', loaderUrl: 'https://hq.support/support.js', sessionEndpoint: '/api/support/session' })
      if (input.endsWith('/csrf-token')) return Response.json({ token: 'csrf' })
      expect(input).toBe('/api/support/session')
      expect(new Headers(init?.headers).get('authorization')).toBe('Bearer native-bearer')
      expect(new Headers(init?.headers).get('x-csrf-token')).toBe('csrf')
      expect(init?.body).toBeUndefined()
      if (wait) await new Promise<void>(resolve => { release = resolve })
      return authenticated ? Response.json({ token: 'scoped-customer-token' }) : Response.json({}, { status: 401 })
    },
    load: async () => ({ createSupport: () => ({ async boot(value) { boots.push(value) }, open() {}, close() {}, async update() {}, async track() {}, shutdown() { shutdowns++ } }) }),
  })
  await mount.refresh()
  expect(boots[0]?.sessionToken).toBe('scoped-customer-token')
  authenticated = false
  events.dispatchEvent(new Event('stacks:auth-changing'))
  expect(shutdowns).toBe(1)
  await mount.refresh()
  expect(boots).toHaveLength(1)
  authenticated = true; wait = true
  const pending = mount.refresh()
  while (!release) await Bun.sleep(1)
  mount.shutdown(); release()
  await pending
  expect(boots).toHaveLength(1)
  const before = requests
  events.dispatchEvent(new Event('stx:navigate'))
  await Bun.sleep(1)
  expect(requests).toBe(before)
})
