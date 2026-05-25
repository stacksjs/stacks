import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LocalStorageAdapter } from '../src/adapters/local'
import { InMemoryStorageAdapter } from '../src/adapters/memory'

// stacksjs/stacks#1886 — streaming primitives across adapters.
// Focused on happy-path bytes-in-bytes-out coverage. Abort-mid-
// stream scenarios live in the per-adapter source docstrings; the
// surface tested here is what users call from app code.

const ROOT = mkdtempSync(join(tmpdir(), 'stacks-streaming-'))

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

function streamFrom(chunks: Array<Uint8Array | string>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks)
        controller.enqueue(typeof c === 'string' ? new TextEncoder().encode(c) : c)
      controller.close()
    },
  })
}

async function drain(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader()
  const out: Uint8Array[] = []
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      if (value) out.push(value)
    }
  }
  finally { try { reader.releaseLock() } catch { /* */ } }
  const total = out.reduce((s, c) => s + c.length, 0)
  const merged = new Uint8Array(total)
  let off = 0
  for (const c of out) { merged.set(c, off); off += c.length }
  return merged
}

describe('memory adapter — streaming', () => {
  const mem = new InMemoryStorageAdapter()

  test('putStream merges chunks and stores the byte string', async () => {
    const result = await mem.putStream!(
      'one.txt',
      streamFrom(['hello, ', 'streaming ', 'world']),
      { contentType: 'text/plain' },
    )
    expect(result.path).toBe('one.txt')
    expect(result.size).toBe('hello, streaming world'.length)
    expect(result.contentType).toBe('text/plain')
    expect(await mem.readToString('one.txt')).toBe('hello, streaming world')
  })

  test('getStream emits the stored bytes', async () => {
    await mem.putStream!('two.bin', streamFrom([new Uint8Array([1, 2, 3, 4, 5])]))
    const out = await drain(await mem.getStream!('two.bin'))
    expect(out).toEqual(new Uint8Array([1, 2, 3, 4, 5]))
  })

  test('round-trip is byte-exact for binary content', async () => {
    const random = new Uint8Array(4096)
    for (let i = 0; i < random.length; i++) random[i] = (i * 31) & 0xFF
    await mem.putStream!('rt.bin', streamFrom([random]))
    const back = await drain(await mem.getStream!('rt.bin'))
    expect(back).toEqual(random)
  })
})

describe('local adapter — streaming', () => {
  let local: LocalStorageAdapter

  beforeAll(() => {
    local = new LocalStorageAdapter({ root: ROOT })
  })

  test('putStream pipes a stream to disk and reports the on-disk size', async () => {
    const result = await local.putStream!(
      'sub/file.txt',
      streamFrom(['alpha ', 'beta ', 'gamma']),
    )
    expect(result.path).toBe('sub/file.txt')
    expect(result.size).toBe('alpha beta gamma'.length)
    expect(typeof result.lastModified).toBe('number')
    expect(await local.readToString('sub/file.txt')).toBe('alpha beta gamma')
  })

  test('getStream reads chunks back from disk', async () => {
    const body = 'x'.repeat(2048)
    await local.putStream!('big.txt', streamFrom([body]))
    const stream = await local.getStream!('big.txt')
    const back = new TextDecoder().decode(await drain(stream))
    expect(back).toBe(body)
  })

  test('getStream throws on missing file', async () => {
    await expect(local.getStream!('nope/missing.txt')).rejects.toThrow()
  })

  test('round-trip with large pseudo-random buffer', async () => {
    const buf = new Uint8Array(64 * 1024)
    for (let i = 0; i < buf.length; i++) buf[i] = (i * 17) & 0xFF
    await local.putStream!('big.bin', streamFrom([buf]))
    const back = await drain(await local.getStream!('big.bin'))
    expect(back.length).toBe(buf.length)
    expect(back).toEqual(buf)
  })
})
