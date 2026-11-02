import assert from 'node:assert/strict'
import { launch, waitFor } from '@stacksjs/testing/browser'
const built = await Bun.build({ entrypoints: [`${import.meta.dir}/boundary-entry.ts`], target: 'browser', format: 'esm' })
assert(built.success, built.logs.join('\n'))
const script = await built.outputs[0]!.text()
const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch(request) {
  return new URL(request.url).pathname === '/client.js'
    ? new Response(script, { headers: { 'content-type': 'application/javascript' } })
    : new Response('<!doctype html><html><body><script type="module" src="/client.js"></script></body></html>', { headers: { 'content-type': 'text/html' } })
} })
let browser: Awaited<ReturnType<typeof launch>> | undefined
try {
  browser = await launch()
  await browser.cdp.send('Page.navigate', { url: `http://127.0.0.1:${server.port}/` })
  const result = JSON.parse(await waitFor(() => browser!.cdp.evaluate<string>('document.querySelector("pre")?.textContent || ""'), 15_000))
  assert.deepEqual(result, { min: 0, max: 249999, samples: [], at: 'undefined', last: 'undefined', average: 1e308, median: 1e308,
    contracts: { largeDeviation: 1e200, tinyDeviation: 1e-200, score: 3, covariance: 0, mixedCovariance: 1e16, cancelledCovariance: 0, selected: 'low',
      tail: [3], calls: 4, shortened: [1], invalid: true, offset: 0, day: '0000-06-01',
      leap: '0000-02-29T12:00:00.000Z', expanded: '+010000-01-01T00:00:37+00:00' } })
  assert.deepEqual(browser.cdp.errors, [])
  console.log('browser array boundaries OK')
}
finally { await browser?.close(); server.stop(true) }
