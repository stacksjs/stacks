import { expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { startTestService } from '../../testing/src/service'
import { runIsolated, assertIsolatedOk } from '../../testing/src/isolated'
import { ownedRedisBinary, ownedRedisFixture } from './fixtures/owned-redis'

// Independent publisher -> owned Redis -> API process -> real HTTP/SSE,
// including outage/restart. No shared Redis and no durable-delivery claim.
test.skipIf(!ownedRedisBinary)('separate Redis workers wake authorized HTTP consumers and resync after service restart', async () => {
  const redis = await ownedRedisFixture(), namespace = `owned-process-${randomUUID()}`
  const env = { ...process.env, STACKS_TEST_REDIS_URL: redis.url, STACKS_TEST_REDIS_NAMESPACE: namespace }
  const worker = resolve(import.meta.dir, 'fixtures/redis-invalidation-worker.ts')
  const api = startTestService([process.execPath, `--config=${redis.config}`, '--no-env-file', worker, 'api'], { cwd: resolve(import.meta.dir, '..'), env, label: 'Independent invalidation API', startupTimeoutMs: 10000 })
  const controllers = [new AbortController(), new AbortController()], pumps: Promise<void>[] = [], frames: string[][] = [[], []]
  async function publish(input: Record<string, unknown>, mode = 'publish') {
    const result = await runIsolated(worker, { args: [mode, JSON.stringify(input)], cwd: resolve(import.meta.dir, '..'), env, envFile: false, preload: [], timeoutMs: 5000 })
    assertIsolatedOk(result)
    return { data: JSON.parse(result.stdout.trim().split('\n').at(-1)!), logs: result.stdout + result.stderr }
  }
  async function until(predicate: () => Promise<boolean> | boolean) { const end = Date.now() + 10000; while (!await predicate()) { if (Date.now() > end) throw new Error('Cross-worker invalidation observation timed out'); await Bun.sleep(5) } }
  try {
    const { origin } = await api.ready as { origin: string }
    const state = async () => await (await fetch(origin + '/state')).json() as { alpha: number, beta: number, closed: number, status: string }
    for (let index = 0; index < 2; index++) {
      const response = await fetch(origin + '/events?channel=untrusted', { headers: { authorization: `Bearer ${index === 0 ? 'alpha' : 'beta'}-fixture` }, signal: controllers[index]!.signal })
      expect(response.status).toBe(200)
      const reader = response.body!.getReader(), decoder = new TextDecoder()
      pumps.push((async () => { let pending = ''; try { while (true) { const result = await reader.read(); if (result.done) break; pending += decoder.decode(result.value, { stream: true }); let end: number; while ((end = pending.indexOf('\n\n')) >= 0) { frames[index]!.push(pending.slice(0, end)); pending = pending.slice(end + 2) } } } catch (error) { if (!controllers[index]!.signal.aborted) throw error } })())
    }
    await until(() => frames.every(items => items.includes(': connected')))
    expect((await publish({ namespace: 'foreign-application', channel: 'private-project.1' })).data.subscriberConnections).toBe(0)
    const malformed = await publish({ channel: 'private-project.1', wire: JSON.stringify({ v: 1, origin: randomUUID(), id: randomUUID(), transcript: 'never-forward-this-body' }) }, 'raw')
    expect(malformed.data.subscriberConnections).toBe(1)
    expect(malformed.logs).not.toContain('never-forward-this-body')
    const valid = await publish({ channel: 'private-project.1' })
    expect(valid.data.subscriberConnections).toBe(1)
    await until(async () => (await state()).alpha === 1)
    expect((await state()).beta).toBe(0)
    const data = frames[0]!.filter(frame => frame.startsWith('data: ')).map(frame => JSON.parse(frame.slice(6)))
    expect(data).toEqual([{ channel: 'private-project.1', event: 'invalidated', data: null }])
    await redis.stop(); await until(async () => (await state()).status === 'disconnected')
    const unavailable = await publish({ channel: 'private-project.1' })
    expect(unavailable.data.error).toBe('invalidation_unavailable')
    expect(unavailable.logs).not.toContain(redis.url)
    expect((await fetch(origin + '/revoke', { method: 'POST', headers: { authorization: 'Bearer fixture-control' } })).status).toBe(200)
    await until(async () => (await state()).closed === 1)
    await redis.restart()
    await until(async () => (await state()).beta >= 1 && (await state()).status === 'ready')
    expect((await state()).alpha).toBe(1)
    expect((await fetch(origin + '/events', { headers: { authorization: 'Bearer alpha-fixture' } })).status).toBe(401)
    const before = (await state()).beta
    await publish({ channel: 'private-project.2' }); await until(async () => (await state()).beta > before)
    controllers[1]!.abort(); await until(async () => (await state()).closed === 2)
    await until(async () => (await publish({ channel: 'private-project.2' })).data.subscriberConnections === 0)
  }
  finally { for (const controller of controllers) controller.abort(); await Promise.allSettled(pumps); await api.stop(); await redis.close() }
}, 40000)
