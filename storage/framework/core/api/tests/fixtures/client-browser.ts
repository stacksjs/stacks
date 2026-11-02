import assert from 'node:assert/strict'
import { launch, waitFor } from '@stacksjs/testing/browser'
import { digestServer } from './digest-server'
const built = await Bun.build({ entrypoints: [`${import.meta.dir}/client-browser-entry.ts`], target: 'browser', format: 'esm' })
assert(built.success, built.logs.join('\n'))
const javascript = await built.outputs[0]!.text()
const backend = digestServer()
const server = Bun.serve({ port: 0, hostname: '127.0.0.1', async fetch(request) {
  const path = new URL(request.url).pathname
  if (path === '/client.js') return new Response(javascript, { headers: { 'content-type': 'application/javascript' } })
  if (path === '/') return new Response('<!doctype html><html><body><script type="module" src="/client.js"></script></body></html>', { headers: { 'content-type': 'text/html' } })
  // Forward through real HTTP, preserving the browser's request target and bytes.
  return fetch(new Request(`http://127.0.0.1:${backend.port}${path}${new URL(request.url).search}`, request), { redirect: 'manual' }).then(response => {
    const location = response.headers.get('location')
    if (!location) return response
    return new Response(null, { status: response.status, headers: { location: new URL(location).pathname } })
  })
} })
let browser: Awaited<ReturnType<typeof launch>> | undefined
try {
  browser = await launch()
  await browser.cdp.send('Page.navigate', { url: `http://127.0.0.1:${server.port}/` })
  const result = await waitFor(() => browser!.cdp.evaluate<string>('document.querySelector("pre")?.textContent || ""'), 20_000)
  assert.equal(result, 'client browser OK')
  // These HTTP failures and the blocked transport port are deliberate contract probes.
  const expected = /^(?:Failed to load resource: the server responded with a status of (?:401 \(Unauthorized\)|422 \(Unprocessable Entity\))|(?:Network: |Failed to load resource: )net::ERR_UNSAFE_PORT)$/
  assert.deepEqual(browser.cdp.errors.filter(error => !expected.test(error)), [])
  console.log(result)
}
catch (error) {
  console.error(JSON.stringify({ error: String(error), browserErrors: browser?.cdp.errors, state: await browser?.cdp.evaluate('({url:location.href, html:document.body.innerHTML})') }))
  throw error
}
finally { await browser?.close(); server.stop(true); backend.stop(true) }
