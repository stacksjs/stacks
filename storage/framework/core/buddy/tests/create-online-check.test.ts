import { describe, expect, test } from 'bun:test'
import { offlineReason } from '../src/commands/create'

const answering = (status: number) => (async () => new Response(null, { status })) as unknown as typeof fetch

describe('buddy new online check', () => {
  test('any HTTP answer from github.com means the network is up', async () => {
    for (const status of [200, 301, 429, 503])
      expect(await offlineReason(answering(status))).toBeNull()
  })

  test('a request that fails reports why', async () => {
    const failing = (async () => { throw new TypeError('getaddrinfo ENOTFOUND github.com') }) as unknown as typeof fetch
    expect(await offlineReason(failing)).toBe('getaddrinfo ENOTFOUND github.com')
  })
})
