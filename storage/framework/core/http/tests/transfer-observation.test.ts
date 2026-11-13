import { expect, spyOn, test } from 'bun:test'
import type { HttpTransferReason } from '../src/index'
import { createHttpTransferObservation, fetchWithBudget } from '../src/index'

// The caller owns body consumption and reports only the bytes it reads.
test('collects bytes read by the caller from a real HTTP response', async () => {
  let requests = 0
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(request) {
      if (new URL(request.url).pathname === '/warm')
        return new globalThis.Response('ready')
      requests++
      return new globalThis.Response('verified-body', { headers: { 'Content-Length': '13' } })
    },
  })
  try {
    await (await fetch(new URL('/warm', server.url))).text()
    const observation = createHttpTransferObservation()
    const response = await fetchWithBudget(server.url, { observer: observation.observer, timeoutMs: 500 })
    const body = response.body
    if (!body)
      throw new Error('The real HTTP response has no readable body')
    const reader = body.getReader()
    const decoder = new TextDecoder()
    let chunks = 0
    let text = ''
    try {
      for (;;) {
        const chunk = await reader.read()
        if (chunk.done)
          break
        if (chunk.value.byteLength) {
          observation.received(chunk.value.byteLength)
          chunks++
          text += decoder.decode(chunk.value, { stream: true })
        }
      }
    }
    finally {
      reader.releaseLock()
    }
    text += decoder.decode()
    const report = observation.finish('complete')
    expect(requests).toBe(1)
    expect(text).toBe('verified-body')
    expect(report.reason).toBe('complete')
    expect(report.bytesReceived).toBe(13)
    expect(report.chunksReceived).toBe(chunks)
    expect(report.response).toEqual({ attempt: 1, responseOrigin: server.url.origin, originOmitted: null, status: 200, contentLength: 13 })
    expect(report.buckets).toHaveLength(12)
    expect(report.buckets[0]?.bytes).toBe(13)
    expect(report.buckets.slice(1).every(bucket => bucket.bytes === 0 && bucket.chunks === 0)).toBe(true)
    expect(report.overflowed).toBe(false)
    expect(report.invalidObservation).toBe(false)
    expect(report.coalesced).toBe(false)
    expect(Object.isFrozen(report)).toBe(true)
    expect(Object.isFrozen(report.buckets)).toBe(true)
  }
  finally {
    server.stop(true)
  }
})

test('finishes once with a deeply immutable report and ignores later observations', () => {
  const observation = createHttpTransferObservation()
  const attempt = { attempt: 1, requestedOrigin: 'https://request.example', originOmitted: null }
  const response = { attempt: 1, responseOrigin: 'https://response.example', originOmitted: null, status: 200, contentLength: 8 }
  observation.observer.onAttempt?.(attempt)
  observation.observer.onResponse?.(response)
  observation.received(3)
  observation.received(5)
  const report = observation.finish('complete')

  attempt.requestedOrigin = 'https://changed.example'
  response.status = 599
  expect(report.attempt?.requestedOrigin).toBe('https://request.example')
  expect(report.response?.status).toBe(200)
  expect(report.bytesReceived).toBe(8)
  expect(report.chunksReceived).toBe(2)
  expect(report.buckets).toHaveLength(12)
  expect(report.buckets.reduce((total, bucket) => total + bucket.bytes, 0)).toBe(8)
  expect(report.buckets.reduce((total, bucket) => total + bucket.chunks, 0)).toBe(2)
  expect(Object.isFrozen(observation)).toBe(true)
  expect(Object.isFrozen(observation.observer)).toBe(true)
  expect(Object.isFrozen(report.attempt)).toBe(true)
  expect(Object.isFrozen(report.response)).toBe(true)
  expect(report.buckets.every(bucket => Object.isFrozen(bucket))).toBe(true)
  expect(Reflect.set(report.buckets[0]!, 'bytes', 999)).toBe(false)
  expect(Reflect.set(report.buckets, 'length', 0)).toBe(false)
  expect(Reflect.set(report.response!, 'status', 599)).toBe(false)

  observation.received(999)
  observation.received(-1)
  observation.observer.onAttempt?.({ attempt: 2, requestedOrigin: null, originOmitted: 'invalid' })
  observation.observer.onResponse?.({ attempt: 2, responseOrigin: null, originOmitted: 'invalid', status: 503, contentLength: null })
  expect(observation.finish('transport')).toBe(report)
  expect(report.reason).toBe('complete')
  expect(report.bytesReceived).toBe(8)
  expect(report.chunksReceived).toBe(2)
  expect(report.buckets).toHaveLength(12)
  expect(report.invalidObservation).toBe(false)
})

test('rejects invalid supplied byte counts and saturates counters without wrapping', () => {
  const observation = createHttpTransferObservation()
  for (const value of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])
    observation.received(value)
  // These are numeric API boundary inputs, not allocated buffers or wire bytes.
  observation.received(Number.MAX_SAFE_INTEGER)
  observation.received(1)
  const report = observation.finish('complete')

  expect(report.bytesReceived).toBe(Number.MAX_SAFE_INTEGER)
  expect(report.chunksReceived).toBe(2)
  expect(report.invalidObservation).toBe(true)
  expect(report.overflowed).toBe(true)
  expect(report.buckets).toHaveLength(12)
  expect(report.buckets[0]?.bytes).toBe(Number.MAX_SAFE_INTEGER)
  expect(report.buckets[0]?.chunks).toBe(2)
  expect(report.buckets.slice(1).every(bucket => bucket.bytes === 0 && bucket.chunks === 0)).toBe(true)
})

test('records monotonic progress windows and coalesces later bytes into the last bucket', () => {
  // The clock is the external boundary. No network latency or throughput is
  // inferred from this worked timeline; the real HTTP fixture covers reads.
  let clockMs = 1000
  const clock = spyOn(performance, 'now').mockImplementation(() => clockMs)
  try {
    const observation = createHttpTransferObservation()
    clockMs = 1010
    observation.observer.onResponse?.({ attempt: 1, responseOrigin: 'https://response.example', originOmitted: null, status: 200, contentLength: 9 })
    clockMs = 1020
    observation.received(2)
    clockMs = 11000
    observation.received(3)
    clockMs = 121000
    observation.received(4)
    clockMs = 121005
    const report = observation.finish('complete')

    expect(report.bytesReceived).toBe(9)
    expect(report.chunksReceived).toBe(3)
    expect(report.headersElapsedMs).toBe(10)
    expect(report.firstByteElapsedMs).toBe(20)
    expect(report.lastByteElapsedMs).toBe(120000)
    expect(report.elapsedMs).toBe(120005)
    expect(report.lastByteAgeMs).toBe(5)
    expect(report.maxInterChunkGapMs).toBe(110000)
    expect(report.buckets).toHaveLength(12)
    expect(report.buckets[0]).toEqual({ fromMs: 0, throughMs: 20, bytes: 2, chunks: 1 })
    expect(report.buckets[1]).toEqual({ fromMs: 10000, throughMs: 10000, bytes: 3, chunks: 1 })
    expect(report.buckets[11]).toEqual({ fromMs: 110000, throughMs: 120000, bytes: 4, chunks: 1 })
    expect(report.coalesced).toBe(true)
    expect(report.overflowed).toBe(false)
    expect(report.invalidObservation).toBe(false)
  }
  finally {
    clock.mockRestore()
  }
})

test('keeps finite monotonic timing when clock observations move backward or become invalid', () => {
  let clockMs = 1000
  const clock = spyOn(performance, 'now').mockImplementation(() => clockMs)
  try {
    const observation = createHttpTransferObservation()
    clockMs = 1100
    observation.received(4)
    clockMs = 1050
    observation.received(2)
    clockMs = Number.NaN
    observation.received(1)
    clockMs = Number.POSITIVE_INFINITY
    const report = observation.finish('idle')

    expect(report.bytesReceived).toBe(7)
    expect(report.chunksReceived).toBe(3)
    expect(report.firstByteElapsedMs).toBe(100)
    expect(report.lastByteElapsedMs).toBe(100)
    expect(report.elapsedMs).toBe(100)
    expect(report.lastByteAgeMs).toBe(0)
    expect(report.maxInterChunkGapMs).toBe(0)
    expect(report.invalidObservation).toBe(true)
    expect(report.overflowed).toBe(false)
    expect(report.buckets[0]).toEqual({ fromMs: 0, throughMs: 100, bytes: 7, chunks: 3 })
  }
  finally {
    clock.mockRestore()
  }
})

test('rejects unsafe diagnostic metadata and never retains private values or errors', () => {
  const observation = createHttpTransferObservation()
  observation.observer.onAttempt?.({ attempt: 1, requestedOrigin: 'https://request.example', originOmitted: null })
  observation.observer.onResponse?.({ attempt: 1, responseOrigin: 'https://response.example', originOmitted: null, status: 200, contentLength: 0 })
  observation.observer.onAttempt?.({ attempt: 2, requestedOrigin: 'https://request.example/private-path?token=private-query', originOmitted: null })
  observation.observer.onResponse?.({ attempt: 2, responseOrigin: 'x'.repeat(513), originOmitted: null, status: 599, contentLength: 0 })
  const throwingMetadata = {
    get attempt(): number { throw new Error('private-getter-error') },
    requestedOrigin: 'https://request.example',
    originOmitted: null,
  }
  expect(() => observation.observer.onAttempt?.(throwingMetadata)).not.toThrow()
  // An untyped caller must not turn an arbitrary reason into retained content.
  const report = observation.finish('private-reason-marker' as HttpTransferReason)

  expect(report.reason).toBe('unknown')
  expect(report.invalidObservation).toBe(true)
  expect(report.attempt).toEqual({ attempt: 1, requestedOrigin: 'https://request.example', originOmitted: null })
  expect(report.response).toEqual({ attempt: 1, responseOrigin: 'https://response.example', originOmitted: null, status: 200, contentLength: 0 })
  expect(report.bytesReceived).toBe(0)
  expect(report.chunksReceived).toBe(0)
  expect(report.firstByteElapsedMs).toBeNull()
  expect(report.lastByteElapsedMs).toBeNull()
  expect(report.lastByteAgeMs).toBeNull()
  const serialized = JSON.stringify(report)
  for (const secret of ['private-path', 'private-query', 'private-getter-error', 'private-reason-marker', 'x'.repeat(513)])
    expect(serialized).not.toContain(secret)
})
