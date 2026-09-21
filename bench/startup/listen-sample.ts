import assert from 'node:assert/strict'
import process from 'node:process'

const entry = process.argv[2]
assert(entry, 'Expected a built entry path')

const runtime = await import(entry)
for (const name of ['createStacksRouter', 'disableViewRouting'])
  assert(name in runtime, `${name} is missing from ${entry}`)

const router = runtime.createStacksRouter({
  autoDiscoverRoutes: false,
  csrf: false,
  requestContext: false,
  requestIds: false,
})
runtime.disableViewRouting(router.bunRouter)
router.get('/ready', () => new Response('{"ready":true}', {
  headers: { 'content-type': 'application/json' },
}))

const server = await router.serve({
  hostname: '127.0.0.1',
  nativeRoutes: true,
  port: 0,
})

const shutdown = () => {
  void server.stop(true)
  process.exit(0)
}
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

console.log(JSON.stringify({
  port: server.port,
  rssBytes: process.memoryUsage().rss,
}))

await new Promise(() => {})
