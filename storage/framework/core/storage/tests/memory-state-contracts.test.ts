import { expect, test } from 'bun:test'
import { InMemoryStorageAdapter } from '../src/adapters/memory'

test('normalized self-moves preserve file bytes and metadata', async () => {
  const disk = new InMemoryStorageAdapter()
  await disk.write('report.txt', 'important')
  await disk.changeVisibility('report.txt', 'public' as never)
  const before = await disk.stat('report.txt')
  await disk.moveFile('/report.txt/', 'report.txt')
  expect(await disk.readToString('report.txt')).toBe('important')
  expect(await disk.stat('report.txt')).toEqual(before)
  await expect(disk.moveFile('missing', 'missing')).rejects.toThrow()
})

test('aborting a pending upload cancels its reader and preserves an existing file', async () => {
  const disk = new InMemoryStorageAdapter()
  await disk.write('upload.txt', 'original')
  const abort = new AbortController()
  let cancelled = false
  const stream = new ReadableStream<Uint8Array>({ cancel() { cancelled = true } })
  const upload = disk.putStream('upload.txt', stream, { signal: abort.signal })
  const outcome = upload.then(() => 'published', () => 'rejected')
  abort.abort()
  expect(await Promise.race([outcome, Bun.sleep(100).then(() => 'pending')])).toBe('rejected')
  expect(cancelled).toBe(true)
  expect(stream.locked).toBe(false)
  expect(await disk.readToString('upload.txt')).toBe('original')
})

test('memory stream writes release their locks on success and failure', async () => {
  const disk = new InMemoryStorageAdapter()
  const success = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array([65])); controller.close() } })
  await disk.write('success.txt', success)
  expect(success.locked).toBe(false)
  expect(await disk.readToString('success.txt')).toBe('A')
  const failed = new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error('source failed')) } })
  await expect(disk.putStream('failed.txt', failed)).rejects.toThrow('source failed')
  expect(failed.locked).toBe(false)
  expect(await disk.fileExists('failed.txt')).toBe(false)
  const abort = new AbortController()
  abort.abort()
  await expect(disk.putStream('aborted.txt', new ReadableStream(), { signal: abort.signal })).rejects.toThrow()
  expect(await disk.fileExists('aborted.txt')).toBe(false)
})
