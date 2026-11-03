import assert from 'node:assert/strict'

const { overridesReady } = await import('@stacksjs/config')
await overridesReady
const { queue: queueConfig } = await import('@stacksjs/config')
const effectiveConnection = queueConfig?.connections?.redis
assert.ok(effectiveConnection, 'dispatch must have a configured Redis connection')
assert.equal(effectiveConnection.redis?.url, process.env.REDIS_URL, 'the fixture must use its owned Redis service')
const { job } = await import('../../src/job')
const { sharedRedisQueue, closeSharedRedisQueues } = await import('../../src/drivers/redis')
const names = ['notifications', 'custom', 'default']
try {
  await job('Routed' as never, { index: 1 } as never).dispatch()
  await job('Routed' as never, { index: 2 } as never).onQueue('custom').dispatch()
  await job('Routed' as never, { index: 3 } as never).onQueue('default').dispatch()
  await job('Plain' as never, { index: 4 } as never).dispatch()
  const rows = await Promise.all(names.map(async name => {
    const queue = sharedRedisQueue(name, effectiveConnection)
    return { name, jobs: await queue.getJobs('waiting') }
  }))
  const envelopes = rows.flatMap(row => row.jobs.map(queued => ({ queue: row.name, data: queued.data as { payload: { index: number }, options: { queue?: string } } })))
    .sort((left, right) => left.data.payload.index - right.data.payload.index)
  assert.deepEqual(envelopes.map(row => row.queue), ['notifications', 'custom', 'default', 'default'], 'Redis persistence must inherit declared routing and preserve explicit overrides')
  assert.deepEqual(envelopes.map(row => row.data.options.queue), ['notifications', 'custom', 'default', undefined], 'the Redis envelope must retain effective queue options')
  console.log('declared redis queue dispatch OK')
}
finally {
  for (const name of names) await sharedRedisQueue(name, effectiveConnection).empty()
  await closeSharedRedisQueues()
}
