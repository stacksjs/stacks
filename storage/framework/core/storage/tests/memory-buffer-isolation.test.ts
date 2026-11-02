import { expect, test } from 'bun:test'
import { InMemoryStorageAdapter } from '../src/adapters/memory'

test('mutating an upload buffer after writing cannot change the stored file', async () => {
  const disk = new InMemoryStorageAdapter()
  const bytes = new Uint8Array([1, 2, 3])
  await disk.write('file.bin', bytes)
  bytes[0] = 9
  expect(await disk.readToUint8Array('file.bin')).toEqual(new Uint8Array([1, 2, 3]))
})

test('mutating read results or stream chunks cannot change the stored file', async () => {
  const disk = new InMemoryStorageAdapter()
  await disk.write('file.bin', new Uint8Array([1, 2, 3]))
  const bytes = await disk.readToUint8Array('file.bin')
  bytes[0] = 9
  expect(await disk.readToUint8Array('file.bin')).toEqual(new Uint8Array([1, 2, 3]))
  const contents = await disk.read('file.bin') as Uint8Array
  contents[1] = 9
  expect(await disk.readToUint8Array('file.bin')).toEqual(new Uint8Array([1, 2, 3]))
  const reader = (await disk.getStream('file.bin')).getReader()
  try {
    const { value } = await reader.read()
    value![2] = 9
    expect(await disk.readToUint8Array('file.bin')).toEqual(new Uint8Array([1, 2, 3]))
  }
  finally { reader.releaseLock() }
})
