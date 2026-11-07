import { afterAll, describe, expect, spyOn, test } from 'bun:test'
import process from 'node:process'
import { closeSharedBrowsers, findChrome, launch, SHARED_CHROME_LINGER_MS } from '../src/browser'

/*
 * One Chrome per process, a browser context per launch. Against the real
 * Chrome on this machine: isolation is the property a shared process could
 * quietly lose, so it is checked through the browser itself, cookies and
 * storage both, with two sessions open at once.
 */
const chrome = findChrome()
const server = Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
  fetch: request => new Response(`<html><body>${request.headers.get('cookie') ?? 'no cookie'}</body></html>`, { headers: { 'content-type': 'text/html' } }),
})
const origin = `http://127.0.0.1:${server.port}`

afterAll(async () => {
  await closeSharedBrowsers()
  server.stop(true)
})

async function open(cdp: any, path = '/'): Promise<void> {
  await cdp.send('Page.navigate', { url: `${origin}${path}` })
  for (let i = 0; i < 100 && await cdp.evaluate(`document.readyState`) !== 'complete'; i++) await Bun.sleep(50)
}

describe.skipIf(!chrome || process.platform === 'win32')('a shared Chrome', () => {
  test('an in-flight expiry cannot retire a Chrome borrowed by the next session', async () => {
    const set = globalThis.setTimeout.bind(globalThis)
    const clear = globalThis.clearTimeout.bind(globalThis)
    let expiry: { timer: ReturnType<typeof setTimeout>, run: () => void } | undefined
    let deliverExpiry = false
    // Model an expiry callback already delivered when the borrower cancels
    // its timer. Its async retirement must recheck the new session lease.
    const setting = spyOn(globalThis, 'setTimeout').mockImplementation((callback: any, delay?: number, ...args: any[]) => {
      const timer = set(callback, delay, ...args)
      if (delay === SHARED_CHROME_LINGER_MS) expiry = { timer, run: () => callback(...args) }
      return timer
    })
    const clearing = spyOn(globalThis, 'clearTimeout').mockImplementation((timer) => {
      if (deliverExpiry && expiry && timer === expiry.timer) {
        deliverExpiry = false
        expiry.run()
      }
      clear(timer)
    })
    let before: Awaited<ReturnType<typeof launch>> | undefined
    let after: Awaited<ReturnType<typeof launch>> | undefined
    try {
      before = await launch()
      expect(await before.cdp.evaluate('1 + 1')).toBe(2)
      await before.close()
      expect(expiry).toBeDefined()
      deliverExpiry = true
      after = await launch()
      expect(after.port).toBe(before.port)
      expect(await after.cdp.evaluate('1 + 1')).toBe(2)
    }
    finally {
      deliverExpiry = false
      clearing.mockRestore()
      setting.mockRestore()
      await before?.close()
      await after?.close()
    }
  }, 60_000)

  test('two sessions at once share the process and nothing else', async () => {
    const first = await launch()
    const startedSecond = Date.now()
    const second = await launch()
    const secondMs = Date.now() - startedSecond
    try {
      expect(second.port).toBe(first.port)
      // A page on a running Chrome, not a cold start.
      expect(secondMs).toBeLessThan(5_000)

      await open(first.cdp)
      await open(second.cdp)
      await first.cdp.evaluate(`document.cookie = 'who=first; path=/'; localStorage.setItem('who', 'first'); true`)

      expect(await second.cdp.evaluate(`document.cookie`)).toBe('')
      expect(await second.cdp.evaluate(`localStorage.getItem('who')`)).toBeNull()
      // And the server sees each context's own cookie jar.
      await open(second.cdp, '/again')
      expect(await second.cdp.evaluate(`document.body.textContent`)).toBe('no cookie')
      await open(first.cdp, '/again')
      expect(await first.cdp.evaluate(`document.body.textContent`)).toBe('who=first')
    }
    finally {
      await Promise.all([first.close(), second.close()])
    }
  }, 60_000)

  test('clearing cookies in one session leaves the other\'s alone', async () => {
    const keep = await launch()
    const clear = await launch()
    try {
      await open(keep.cdp)
      await open(clear.cdp)
      // A renderer cookie assignment queues a write on a different IPC pipe
      // from DevTools deletion. Establish committed native jars before asking
      // whether clearing one context preserves the other; no timing delay is
      // a substitute for the cookie manager's acknowledged write.
      expect((await keep.cdp.send('Network.setCookie', { name: 'kept', value: 'yes', url: origin, path: '/' })).success).toBe(true)
      expect((await clear.cdp.send('Network.setCookie', { name: 'gone', value: 'yes', url: origin, path: '/' })).success).toBe(true)
      expect((await keep.cdp.send('Network.getCookies', { urls: [origin] })).cookies.map((cookie: { name: string, value: string }) => `${cookie.name}=${cookie.value}`)).toEqual(['kept=yes'])
      expect((await clear.cdp.send('Network.getCookies', { urls: [origin] })).cookies.map((cookie: { name: string, value: string }) => `${cookie.name}=${cookie.value}`)).toEqual(['gone=yes'])
      await clear.cdp.send('Network.clearBrowserCookies')
      const cleared = await clear.cdp.evaluate(`document.cookie`)
      if (cleared !== '') {
        // Preserve the failing observation before diagnostic commands yield.
        // A stale renderer read and an uncleared native cookie jar are different bugs.
        try {
          console.error('shared-cookie-failure', JSON.stringify({
            observed: cleared,
            version: await clear.cdp.send('Browser.getVersion'),
            clearedJar: await clear.cdp.send('Network.getCookies', { urls: [origin] }),
            retainedJar: await keep.cdp.send('Network.getCookies', { urls: [origin] }),
            subsequentDom: await clear.cdp.evaluate(`document.cookie`),
          }))
        }
        catch (error) { console.error('shared-cookie-diagnostic-failure', String(error)) }
      }
      expect(cleared).toBe('')
      expect(await keep.cdp.evaluate(`document.cookie`)).toBe('kept=yes')
    }
    finally {
      await Promise.all([keep.close(), clear.close()])
    }
  }, 60_000)

  test('a closed session leaves nothing for the next, and the Chrome stops after it lingers', async () => {
    const before = await launch()
    const port = before.port
    await open(before.cdp)
    await before.cdp.evaluate(`document.cookie = 'stale=yes; path=/'; localStorage.setItem('stale', 'yes'); true`)
    await before.close()

    const after = await launch()
    try {
      expect(after.port).toBe(port)
      await open(after.cdp)
      expect(await after.cdp.evaluate(`document.cookie`)).toBe('')
      expect(await after.cdp.evaluate(`localStorage.getItem('stale')`)).toBeNull()
    }
    finally {
      await after.close()
    }

    await Bun.sleep(SHARED_CHROME_LINGER_MS + 3_000)
    const answered = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1_000) }).then(() => true).catch(() => false)
    expect(answered).toBe(false)
  }, 60_000)

  test('a launch that keeps a profile, or asks not to share, gets a Chrome of its own', async () => {
    const shared = await launch()
    const own = await launch({ shared: false })
    try {
      expect(own.port).not.toBe(shared.port)
    }
    finally {
      await Promise.all([shared.close(), own.close()])
    }
  }, 60_000)
})
