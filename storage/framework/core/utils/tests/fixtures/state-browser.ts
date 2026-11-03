import assert from 'node:assert/strict'
import { launch, waitFor } from '@stacksjs/testing/browser'
import { startStateServer } from './state-server'
const started = Date.now()
const progress = (stage: string) => console.log(`utility browser ${stage}: ${Date.now() - started}ms`)
progress('building')
const built = await Bun.build({ entrypoints: [`${import.meta.dir}/state-entry.ts`], target: 'browser', format: 'esm' })
assert(built.success, built.logs.join('\n'))
const server = await startStateServer(await built.outputs[0]!.text())
progress('server ready')
let browser: Awaited<ReturnType<typeof launch>> | undefined
try {
  progress('launching')
  browser = await launch()
  progress('launched')
  await browser.cdp.send('Page.navigate', { url: server.url })
  progress('navigated')
  const result = JSON.parse(await waitFor(() => browser!.cdp.evaluate<string>('document.querySelector("pre")?.textContent || ""'), 15_000))
  assert.deepEqual(result, { seen: ['first', 'second'], throttled: 42, shared: '{"first":{"id":1},"second":{"id":1}}',
    url: 'https://example.test/path', inherited: false, invalidMask: true,
    first: '9007199254740993', second: '9007199254740994', tupleSecond: '9007199254740994', previous: '9007199254740993', tuplePrevious: '9007199254740993',
    snapshot: { serialized: '{"first":{"id":1},"second":{"id":1}}' }, cache: JSON.parse('{"__proto__":{"value":1}}'), move: { contents: 'important' } })
  progress('assertions complete')
  assert.deepEqual(browser.cdp.errors, [])
  console.log('utility state browser OK')
}
finally {
  progress('closing')
  try { await browser?.close() }
  finally { await server.close(); progress('closed') }
}
