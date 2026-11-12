/**
 * A write that fails leaves the file it would have replaced.
 *
 * The local adapter wrote in place: the existing file was truncated before
 * the first byte of the new one arrived. A stream that errored or was aborted
 * left the old contents gone and the new ones partial, and `putStream` then
 * deleted the partial file to tidy up - so a failed re-upload removed the
 * file. Writes now go through a temporary file renamed into place.
 *
 * Both filesystem adapters are held to it. The Bun adapter wrote a stream with
 * `Bun.write(path, new Response(stream))`, which never resolves on Bun 1.3, and
 * nothing here ran against it; `stream-writes-min-bun.test.ts` runs this file
 * under that Bun.
 */

import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { BunStorageAdapter } from '../src/adapters/bun'
import { LocalStorageAdapter } from '../src/adapters/local'

let root: string
let disk: LocalStorageAdapter | BunStorageAdapter

const ADAPTERS = [['local', LocalStorageAdapter], ['bun', BunStorageAdapter]] as const

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'stacks-atomic-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

/** A stream that sends `before`, then fails. */
function failingStream(before: string): ReadableStream<Uint8Array> {
  let sent = false
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (!sent) {
        sent = true
        controller.enqueue(new TextEncoder().encode(before))
        return
      }
      controller.error(new Error('connection reset'))
    },
  })
}

/** A stream that sends one chunk, then waits forever. */
function stallingStream(chunk: string): ReadableStream<Uint8Array> {
  let sent = false
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (!sent) {
        sent = true
        controller.enqueue(new TextEncoder().encode(chunk))
        return
      }
      return new Promise(() => {})
    },
  })
}

const leftovers = (): string[] => readdirSync(root).filter(name => name.endsWith('.tmp'))

describe.each(ADAPTERS)('the %s adapter', (_name, Adapter) => {
  beforeEach(() => {
    disk = new Adapter({ root })
  })

  test('a putStream that fails keeps the file it was replacing', async () => {
    writeFileSync(join(root, 'avatar.png'), 'the original')

    await expect(disk.putStream('avatar.png', failingStream('half of the new'))).rejects.toThrow('connection reset')

    expect(readFileSync(join(root, 'avatar.png'), 'utf8')).toBe('the original')
    expect(leftovers()).toEqual([])
  })

  test('an aborted putStream keeps it too', async () => {
    writeFileSync(join(root, 'avatar.png'), 'the original')
    const controller = new AbortController()

    const upload = disk.putStream('avatar.png', stallingStream('part'), { signal: controller.signal })
    setTimeout(() => controller.abort(), 20)

    await expect(upload).rejects.toThrow()
    expect(readFileSync(join(root, 'avatar.png'), 'utf8')).toBe('the original')
    expect(leftovers()).toEqual([])
  })

  test('a write() of a failing stream keeps it too', async () => {
    writeFileSync(join(root, 'report.csv'), 'the original')

    await expect(disk.write('report.csv', failingStream('half'))).rejects.toThrow('connection reset')

    expect(readFileSync(join(root, 'report.csv'), 'utf8')).toBe('the original')
    expect(leftovers()).toEqual([])
  })

  test('a completed write replaces the file, and keeps its mode', async () => {
    writeFileSync(join(root, 'secret.txt'), 'old', { mode: 0o600 })

    const result = await disk.write('secret.txt', 'new contents')

    expect(readFileSync(join(root, 'secret.txt'), 'utf8')).toBe('new contents')
    expect(statSync(join(root, 'secret.txt')).mode & 0o777).toBe(0o600)
    expect(result.size).toBe(12)
    expect(leftovers()).toEqual([])
  })

  test('streams, strings and bytes all land, in a new directory too', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('streamed'))
        controller.close()
      },
    })

    await disk.putStream('a/b/stream.txt', stream)
    await disk.write('a/text.txt', 'text')
    await disk.write('a/bytes.bin', new Uint8Array([1, 2, 3]))

    expect(readFileSync(join(root, 'a/b/stream.txt'), 'utf8')).toBe('streamed')
    expect(readFileSync(join(root, 'a/text.txt'), 'utf8')).toBe('text')
    expect([...readFileSync(join(root, 'a/bytes.bin'))]).toEqual([1, 2, 3])
  })

  test('a stream far larger than any buffer lands whole', async () => {
    const chunk = new Uint8Array(64 * 1024).fill(0x41)
    let left = 1024 // 64 MB
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (left-- > 0)
          controller.enqueue(chunk)
        else
          controller.close()
      },
    })

    const result = await disk.putStream('big.bin', stream)

    expect(result.size).toBe(64 * 1024 * 1024)
    expect(statSync(join(root, 'big.bin')).size).toBe(64 * 1024 * 1024)
    expect(leftovers()).toEqual([])
  })
})
