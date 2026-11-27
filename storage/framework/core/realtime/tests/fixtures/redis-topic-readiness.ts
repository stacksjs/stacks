import assert from 'node:assert/strict'
import { createRedisInvalidationBus } from '../../src/redis-invalidations'

const commands: { topics: string[], acknowledge: () => void }[] = []
class ControlledRedis {
  connected = false
  onclose = null
  async connect() { this.connected = true }
  close() { this.connected = false }
  async publish() { return 1 }
  subscribe(topics: string[]) {
    const acknowledgement = Promise.withResolvers<void>()
    commands.push({ topics, acknowledge: () => acknowledgement.resolve() })
    return acknowledgement.promise
  }
  async unsubscribe() {}
}

Reflect.set(Bun, 'RedisClient', ControlledRedis)
assert.equal(Bun.RedisClient, ControlledRedis)
const bus = createRedisInvalidationBus({ url: 'redis://127.0.0.1:1', namespace: 'topic-readiness', operationTimeoutMs: 500 })
const completions: string[] = []
function register(topic: string) {
  return bus.subscribe({ channels: [topic], onInvalidate() {} }).then(release => {
    completions.push(`${topic}:ready`)
    return release
  }, () => { completions.push(`${topic}:unavailable`) })
}
async function waitForCommands(count: number) {
  const deadline = performance.now() + 300
  while (commands.length < count && performance.now() < deadline) await Bun.sleep(1)
  assert.equal(commands.length, count)
}
try {
  const first = register('customer.first')
  await waitForCommands(1)
  const second = register('customer.second')
  commands[0]!.acknowledge()
  await waitForCommands(2)
  assert.notDeepEqual(commands[0]!.topics, commands[1]!.topics)
  assert.deepEqual([...completions], ['customer.first:ready'], 'the first topic is ready while Redis is still processing the second')
  const reusing = register('customer.first')
  await Bun.sleep(1)
  assert.deepEqual([...completions], ['customer.first:ready', 'customer.first:ready'], 'a new registration can reuse an already acknowledged topic')
  const [release, reusedRelease] = await Promise.all([first, reusing, second])
  assert.deepEqual(completions, ['customer.first:ready', 'customer.first:ready', 'customer.second:unavailable'])
  assert.equal(typeof release, 'function')
  assert.equal(typeof reusedRelease, 'function')
  release?.()
  reusedRelease?.()
  console.info('PASS Redis topic readiness')
}
finally { await bus.close() }
