import { expect, test } from 'bun:test'
import { createLibraryReleaseReader } from '../src/library/release-network'

// Owned HTTP transport proves deadline, retry and body bounds, independent of credentials.
test('retries only processing 404, 429 and 5xx under one deadline against actual HTTP', async () => {
  let count = 0
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch() {
    count++
    return count < 4 ? new Response('', { status: [429, 503, 404][count - 1], headers: { 'retry-after': '0' } }) : new Response('verified')
  } })
  try {
    const reader = createLibraryReleaseReader({ deadlineMs: 1000, requestTimeoutMs: 100, retryDelayMs: 1 })
    expect(new TextDecoder().decode(await reader.read(server.url.href, { processing: true }))).toBe('verified')
    expect(count).toBe(4)
  }
  finally { server.stop(true) }
})

test('authorization, schema/body bounds and redirects are terminal without retry', async () => {
  for (const status of [401, 403, 302, 422]) {
    let count = 0
    const reader = createLibraryReleaseReader({ retryDelayMs: 1, deadlineMs: 100, fetch: async () => { count++; return new Response('', { status }) } })
    await expect(reader.read('https://registry.npmjs.org')).rejects.toThrow(`HTTP ${status}`)
    expect(count).toBe(1)
  }
  let count = 0
  const reader = createLibraryReleaseReader({ retryDelayMs: 1, deadlineMs: 100, fetch: async () => { count++; return new Response('oversized') } })
  await expect(reader.read('https://registry.npmjs.org', { maxBytes: 2 })).rejects.toThrow('byte budget')
  expect(count).toBe(1)
})

test('bounds hanging response bodies and honors Retry-After without passing its deadline', async () => {
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
    if (new URL(request.url).pathname === '/delay') return new Response('', { status: 429, headers: { 'retry-after': '60' } })
    return new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([1])) } }))
  } })
  try {
    for (const path of ['/body', '/delay']) {
      const start = performance.now()
      const reader = createLibraryReleaseReader({ deadlineMs: 80, requestTimeoutMs: 20, retryDelayMs: 1 })
      await expect(reader.read(new URL(path, server.url).href)).rejects.toThrow('deadline exceeded')
      expect(performance.now() - start).toBeLessThan(500)
    }
  }
  finally { server.stop(true) }
})
