import { createRedisInvalidationBus } from '../../src/redis-invalidations'
import { createBroadcastResponse } from '../../src/stream'
import { createBroadcastHub, stopServer } from '../../src/server-instance'
import { notifyTestServiceReady } from '../../../testing/src/service'
import { RedisClient } from 'bun'
import { createHash } from 'node:crypto'

const [mode, serialized = '{}'] = process.argv.slice(2), input = JSON.parse(serialized)
const url = process.env.STACKS_TEST_REDIS_URL!, parsed = new URL(url)
if (parsed.hostname !== '127.0.0.1' || parsed.protocol !== 'redis:') throw new Error('Only the task-owned loopback Redis fixture is allowed')
const namespace = input.namespace ?? process.env.STACKS_TEST_REDIS_NAMESPACE!
const bus = createRedisInvalidationBus({ url, namespace, connectTimeoutMs: 200, operationTimeoutMs: 200, reconnectDelayMs: 10, maxReconnectDelayMs: 100 })
if (mode === 'api') {
  createBroadcastHub()
  const grants = new Map([['alpha-fixture', true], ['beta-fixture', true]])
  const counts = { alpha: 0, beta: 0, closed: 0 }
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
    const path = new URL(request.url).pathname
    if (path === '/state') return Response.json({ ...counts, status: bus.status })
    if (path === '/revoke' && request.method === 'POST' && request.headers.get('authorization') === 'Bearer fixture-control') { grants.set('alpha-fixture', false); return Response.json({ revoked: true }) }
    if (path !== '/events') return new Response('Not found', { status: 404 })
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? ''
    const alpha = token === 'alpha-fixture', channel = alpha ? 'private-project.1' : 'private-project.2'
    return await createBroadcastResponse({ channels: [channel], invalidations: bus, signal: request.signal, heartbeatMs: 30, authorize: () => grants.get(token) === true, onEnqueue(chunk, metadata) { if (chunk.byteLength && metadata?.event === 'invalidated') counts[alpha ? 'alpha' : 'beta']++ }, onClose() { counts.closed++ } })
  } })
  const stopped = Promise.withResolvers<void>()
  const stop = () => stopped.resolve()
  process.once('SIGTERM', stop); process.once('SIGINT', stop)
  try { await new Promise<void>((resolve, reject) => { if (!notifyTestServiceReady({ origin: server.url.origin }, error => error ? reject(error) : resolve())) reject(new Error('API fixture requires its lifecycle owner')) }); await stopped.promise }
  finally { await bus.close(); server.stop(true); await stopServer() }
}
else {
  try {
    if (mode === 'raw') {
      const client = new RedisClient(url, { autoReconnect: false, enableOfflineQueue: false, maxRetries: 0, connectionTimeout: 200 })
      client.onclose = () => {}
      try { const topic = `${namespace}:invalidation:v1:${createHash('sha256').update(input.channel).digest('hex')}`; await client.connect(); console.info(JSON.stringify({ subscriberConnections: await client.publish(topic, input.wire) })) }
      finally { client.close() }
    }
    else { try { console.info(JSON.stringify(await bus.publish(input.channel))) } catch (error) { console.info(JSON.stringify({ error: error && typeof error === 'object' && 'code' in error ? error.code : 'unavailable' })) } }
  }
  finally { await bus.close() }
}
