import { describe, expect, it } from 'bun:test'
import { stream } from '../src/stacks-router'

/**
 * `stream()` asks its source for a chunk only when the reader wants one.
 *
 * It drained the whole async iterable into the stream's queue from `start()`,
 * so a generator faster than its client grew the queue without bound:
 * 130,000 queued chunks and 2.3 GB in 300ms with nobody reading.
 */
describe('stream()', () => {
  it('pulls from the generator only as fast as the body is read', async () => {
    let produced = 0
    // Bounded, so a stream that drains it eagerly finishes (and fails the
    // assertion) instead of growing until the process dies.
    async function* plenty() {
      for (let i = 0; i < 5000; i++) {
        produced++
        yield 'x'.repeat(1024)
      }
    }

    const response = stream(plenty())
    await Bun.sleep(50)
    // Nobody has read anything: at most the stream's one-chunk buffer.
    expect(produced).toBeLessThanOrEqual(2)

    const reader = response.body!.getReader()
    for (let i = 0; i < 5; i++)
      await reader.read()
    await Bun.sleep(20)
    expect(produced).toBeLessThanOrEqual(7)
    await reader.cancel()
  })

  it('ends the generator when the response is cancelled', async () => {
    let finished = false
    async function* source() {
      try {
        while (true)
          yield 'tick\n'
      }
      finally {
        finished = true
      }
    }

    const reader = stream(source(), { type: 'sse' }).body!.getReader()
    await reader.read()
    await reader.cancel()
    expect(finished).toBe(true)
  })

  it('still delivers every chunk, strings and bytes, and the error a source throws', async () => {
    async function* source() {
      yield 'a'
      yield new Uint8Array([98])
    }
    expect(await stream(source()).text()).toBe('ab')

    async function* failing() {
      yield 'a'
      throw new Error('source failed')
    }
    await expect(stream(failing()).text()).rejects.toThrow('source failed')
  })
})
