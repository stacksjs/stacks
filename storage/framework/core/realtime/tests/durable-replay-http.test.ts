import { expect, test } from 'bun:test'
import { createDurableReplayResponse, publishDurableReplay } from '../src/durable-replay-http'
import { createSqlDurableReplayStore } from '../src/durable-replay-sql'
import { sqliteReplayFixture } from './fixtures/sqlite-replay'

test('actual HTTP replay rechecks current request/channel authority after real SQL and hides failures', async () => {
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
  let held = false
  const fixture = sqliteReplayFixture(async () => { if (held) { held = false; entered.resolve(); await release.promise } })
  const store = createSqlDurableReplayStore(fixture.connection)
  const grants = new Map([['alpha', new Set(['private-orders.1'])], ['beta', new Set(['private-orders.2'])]])
  await store.append({ channel: 'private-orders.1', event: 'changed', data: 'alpha-private', idempotencyKey: 'one' })
  await store.append({ channel: 'private-orders.2', event: 'changed', data: 'beta-private', idempotencyKey: 'two' })
  // Credentials/grants are the deliberately supplied application-authorizer
  // boundary. Core must call it on this request; it cannot infer authority
  // from workspace/channel strings, a cursor or a previous subscription.
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
    const url = new URL(request.url), token = request.headers.get('authorization')?.replace('Bearer ', '') || ''
    const channel = url.pathname === '/one' ? 'private-orders.1' : 'private-orders.2'
    return createDurableReplayResponse({ store, channel, after: null, async authorize(selected) { if (token === 'broken-type') throw new TypeError('private-authorizer-type-diagnostic'); if (token === 'broken') throw new Error('private-authorizer-diagnostic'); return grants.get(token)?.has(selected) ?? false } })
  } })
  const get = (path: string, token: string) => fetch(new URL(path, server.url), { headers: { authorization: `Bearer ${token}` } })
  try {
    const owned = await get('/one?workspace=2&channel=private-orders.2', 'alpha')
    expect(owned.status).toBe(200); expect(owned.headers.get('cache-control')).toBe('no-store')
    expect((await owned.json() as any).messages.map((message: any) => message.data)).toEqual(['alpha-private'])
    const foreign = await get('/one', 'beta')
    expect(foreign.status).toBe(403); expect(await foreign.text()).not.toContain('alpha-private')
    const broken = await get('/one', 'broken')
    expect(broken.status).toBe(503); expect(await broken.text()).not.toContain('private-authorizer-diagnostic')
    expect((await get('/one', 'broken-type')).status).toBe(503)
    const invalid = await createDurableReplayResponse({ store, channel: 'private-orders.1', after: { incarnation: 'not-a-cursor', seq: true } as any, authorize: () => true })
    expect(invalid.status).toBe(422)
    held = true
    const pending = get('/one', 'alpha')
    await entered.promise
    grants.get('alpha')!.clear(); release.resolve()
    const revoked = await pending
    expect(revoked.status).toBe(403); expect(await revoked.text()).not.toContain('alpha-private')
    expect((await get('/one', 'alpha')).status).toBe(403)
    expect((await get('/two', 'beta')).status).toBe(200)
    await expect(createDurableReplayResponse({ store, channel: 'private-orders.1', after: null, authorize: undefined as any })).rejects.toThrow('authorization')
  }
  finally { release.resolve(); server.stop(true); fixture.database.close() }
})

test('a failed notification leaves a durable event and retry republishes the same cursor', async () => {
  const fixture = sqliteReplayFixture(), store = createSqlDurableReplayStore(fixture.connection)
  const input = { channel: 'private-orders.1', event: 'changed', data: 'durable-private', idempotencyKey: 'commit-before-notify' }
  try {
    await expect(publishDurableReplay({ store, input, notify() { throw new Error('Notification unavailable') } })).rejects.toThrow('Notification unavailable')
    const saved = await store.replay({ channel: input.channel, after: null })
    expect(saved.messages).toHaveLength(1)
    let delivered: unknown
    const retried = await publishDurableReplay({ store, input, notify(channel, message, cursor) { delivered = { channel, message, cursor } } })
    expect(retried.duplicate).toBe(true)
    expect(delivered).toEqual({ channel: input.channel, message: saved.messages[0], cursor: saved.cursor })
    expect((await store.replay({ channel: input.channel, after: saved.cursor })).messages).toEqual([])
  }
  finally { fixture.database.close() }
})
