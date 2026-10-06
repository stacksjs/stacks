// Uses useSearchEngine() in the same tick the module loads, before the driver
// can have resolved, and reports what the proxy did. For early-proxy.test.ts.
const { useSearchEngine, searchEngineReady } = await import('../../src')

const engine = useSearchEngine()
const thenBeforeLoad = typeof (engine as unknown as { then?: unknown }).then
const awaited = await Promise.race([
  (async () => engine)().then(() => 'settled'),
  new Promise(resolve => setTimeout(resolve, 2000, 'hung')),
])
const missing = await (engine as unknown as { noSuchMethod: () => Promise<unknown> }).noSuchMethod()
  .then(() => 'resolved', (error: Error) => `rejected: ${error.message}`)
await searchEngineReady()

console.log(JSON.stringify({ thenBeforeLoad, awaited, missing }))
process.exit(0)
