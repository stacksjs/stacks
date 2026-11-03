import assert from 'node:assert/strict'
import { launch, waitFor } from '@stacksjs/testing/browser'
import { startHelperServer } from './helper-server'
const built = await Bun.build({ entrypoints: [`${import.meta.dir}/helper-browser-entry.ts`], target: 'browser', format: 'esm' })
assert(built.success, built.logs.join('\n'))
const server = startHelperServer(await built.outputs[0]!.text())
let browser: Awaited<ReturnType<typeof launch>> | undefined
try {
  console.log('helper browser launching')
  browser = await launch()
  await browser.cdp.send('Page.navigate', { url: server.url })
  const output = JSON.parse(await waitFor(async () => {
    if (browser!.cdp.errors.length) throw new Error(browser!.cdp.errors.join('\n'))
    return browser!.cdp.evaluate<string>('document.querySelector("pre")?.textContent || ""')
  }, 15_000))
  assert.deepEqual(output, { polyCalls: 3, recovered: 2, nativeRecovered: 2, expectedErrors: 2, disconnectedCalls: 1, http: { pipeline: 2, omitted: ['2'], graph: true, external: 'external', prototypeOwn: true, retry: 42, cells: 2 } })
  assert.deepEqual(browser.cdp.errors, [])
  console.log('helper browser OK')
}
finally { try { await browser?.close() } finally { server.close() } }
