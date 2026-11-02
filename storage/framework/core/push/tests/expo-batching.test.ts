import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { configure, getReceipts, resetConfiguration, send } from '../src/drivers/expo'

/**
 * stacksjs/stacks#3098. Expo takes at most 100 messages and 1000 receipt IDs
 * per request and refuses the whole request past that. The stub answers as
 * Expo did when asked with fake tokens:
 *   101 messages  HTTP 400 "\"$\": Must contain at most 100 element(s)."
 *   1001 receipts HTTP 400 PUSH_TOO_MANY_RECEIPTS
 * Swapping globalThis.fetch rather than mock.module, which would leak into
 * every other test file in the process.
 */
const realFetch = globalThis.fetch
let requests: Array<{ url: string, count: number }> = []
let failRequest: number | undefined

const token = (i: number) => `ExponentPushToken[test${String(i).padStart(6, '0')}]`

beforeEach(() => {
  requests = []
  failRequest = undefined
  configure({ accessToken: 'test-access-token' })
  globalThis.fetch = (async (input: any, init: any = {}) => {
    const url = String(input)
    const body = JSON.parse(init.body)
    if (url.endsWith('/getReceipts')) {
      requests.push({ url, count: body.ids.length })
      if (body.ids.length > 1000)
        return new Response(JSON.stringify({ errors: [{ code: 'PUSH_TOO_MANY_RECEIPTS' }] }), { status: 400 })
      return new Response(JSON.stringify({ data: Object.fromEntries(body.ids.map((id: string) => [id, { status: 'ok' }])) }))
    }
    requests.push({ url, count: body.length })
    if (body.length > 100)
      return new Response(JSON.stringify({ errors: [{ code: 'VALIDATION_ERROR', message: '"$": Must contain at most 100 element(s).' }] }), { status: 400 })
    if (requests.length === failRequest)
      return new Response('upstream unavailable', { status: 503 })
    return new Response(JSON.stringify({ data: body.map((m: { to: string }) => ({ status: 'ok', id: `ticket-${m.to}` })) }))
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
  resetConfiguration()
})

describe('sending to many Expo devices', () => {
  it('sends 250 tokens in requests of at most 100 and reaches all of them', async () => {
    const to = Array.from({ length: 250 }, (_, i) => token(i))
    const result = await send({ to, body: 'Hello' })

    expect(requests.map(r => r.count)).toEqual([100, 100, 50])
    expect(result.success).toBe(true)
    expect(result.message).toBe('Sent 250/250 notifications')
    const tickets = (result.data as { tickets: Array<{ id?: string }> }).tickets
    expect(tickets).toHaveLength(250)
    expect(tickets[249]?.id).toBe(`ticket-${token(249)}`)
  })

  it('keeps the other requests going when one is refused', async () => {
    failRequest = 2
    const to = Array.from({ length: 250 }, (_, i) => token(i))
    const result = await send({ to, body: 'Hello' })

    expect(result.success).toBe(false)
    expect(result.message).toBe('Sent 150/250 notifications')
    const tickets = (result.data as { tickets: Array<{ status: string }> }).tickets
    expect(tickets.slice(100, 200).every(t => t.status === 'error')).toBe(true)
    expect(tickets[0]?.status).toBe('ok')
    expect(tickets[249]?.status).toBe('ok')
  })

  it('counts a token that is not an Expo token as a failure, in its own place', async () => {
    const result = await send({ to: [token(1), 'not a token!', token(2)], body: 'Hello' })

    expect(result.success).toBe(false)
    expect(result.message).toBe('Sent 2/3 notifications')
    const tickets = (result.data as { tickets: Array<{ status: string, id?: string }> }).tickets
    expect(tickets.map(t => t.status)).toEqual(['ok', 'error', 'ok'])
    expect(tickets[2]?.id).toBe(`ticket-${token(2)}`)
  })
})

describe('reading many Expo receipts', () => {
  it('asks for 2500 receipts 1000 at a time and merges them', async () => {
    const ids = Array.from({ length: 2500 }, (_, i) => `receipt-${i}`)
    const receipts = await getReceipts(ids)

    expect(requests.map(r => r.count)).toEqual([1000, 1000, 500])
    expect(Object.keys(receipts)).toHaveLength(2500)
  })
})
