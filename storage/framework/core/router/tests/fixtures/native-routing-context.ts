import { contextHasWritten, initializeDbConfig, markContextWrote } from '@stacksjs/database'
import { createStacksRouter } from '../../src/stacks-router'

// A declared replica makes the database package establish request-local
// read-routing state. Let the project's async config load finish first so it
// cannot overwrite the fixture config afterwards. No connection is opened.
const { overridesReady } = await import('@stacksjs/config')
await overridesReady
initializeDbConfig({
  database: {
    default: 'mysql',
    connections: {
      mysql: {
        host: 'primary.invalid',
        replicas: [{ host: 'replica.invalid' }],
      },
    },
  },
})

const router = createStacksRouter()
const writing = Promise.withResolvers<void>()
const release = Promise.withResolvers<void>()

router.get('/__native_routing_write', async () => {
  const before = contextHasWritten()
  markContextWrote()
  writing.resolve()
  await release.promise
  return { before, after: contextHasWritten() }
})
router.get('/__native_routing_read', () => ({ wrote: contextHasWritten() }))

const server = await router.serve({ port: 0, nativeRoutes: true })
try {
  const writer = fetch(`http://localhost:${server.port}/__native_routing_write`)
  await writing.promise
  const reader = await fetch(`http://localhost:${server.port}/__native_routing_read`)
  const isolated = await reader.json()
  release.resolve()
  const written = await (await writer).json()

  if (JSON.stringify(written) !== JSON.stringify({ before: false, after: true }))
    throw new Error(`Native writer lost its routing context: ${JSON.stringify(written)}`)
  if (JSON.stringify(isolated) !== JSON.stringify({ wrote: false }))
    throw new Error(`Native request contexts leaked: ${JSON.stringify(isolated)}`)
  if (contextHasWritten())
    throw new Error('Native routing context leaked outside the request')

  console.log('native-routing-context-ok')
}
finally {
  release.resolve()
  await server.stop(true)
}
