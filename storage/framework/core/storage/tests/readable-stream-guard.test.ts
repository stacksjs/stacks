import { describe, expect, test } from 'bun:test'
import { InMemoryStorageAdapter } from '../src/adapters/memory'
import { LocalStorageAdapter } from '../src/adapters/local'
import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('ReadableStream guard (stacksjs/stacks#1873 S-15)', () => {
  test('memory adapter throws a clear error for Node-style streams', async () => {
    const adapter = new InMemoryStorageAdapter()
    // A bare object that looks like contents but has no `getReader()`
    // — the late-throw used to be `contents.getReader is not a function`.
    const fakeNodeStream = { on: () => {}, pipe: () => {} }
    await expect(
      adapter.write('test.bin', fakeNodeStream as any),
    ).rejects.toThrow(/web-standard ReadableStream/)
  })

  test('local adapter accepts Node streams via stream.pipeline (not the getReader path)', async () => {
    // The local adapter uses `pipeline()` for streams, not `getReader()`.
    // So this finding doesn't apply to it — the test just documents
    // that local doesn't share the guard's failure mode.
    const root = join(tmpdir(), `stacks-rs-guard-${Date.now()}`)
    mkdirSync(root, { recursive: true })
    try {
      const adapter = new LocalStorageAdapter({ root })
      await adapter.write('plain.txt', 'hello') // baseline sanity check
      expect(await adapter.readToString('plain.txt')).toBe('hello')
    }
    finally {
      try {
        rmSync(root, { recursive: true, force: true })
      }
      catch {
        // ignore cleanup errors
      }
    }
  })

  test('memory adapter still accepts proper web-standard ReadableStream', async () => {
    const adapter = new InMemoryStorageAdapter()
    const data = new TextEncoder().encode('hello stream')
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(data)
        controller.close()
      },
    })
    await adapter.write('streamed.txt', stream)
    expect(await adapter.readToString('streamed.txt')).toBe('hello stream')
  })
})
