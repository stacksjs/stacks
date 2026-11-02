import { expect, test } from 'bun:test'
import { S3StorageAdapter } from '../src/adapters/s3'

function disk(prefix = '') {
  const keys = new Set(['photos/a.jpg', 'photos/deep/b.jpg', 'notes.txt', 'other/file.txt'])
  const client = {
    async listAllObjects(options: { prefix?: string }) {
      return [...keys].filter(key => key.startsWith(options.prefix ?? '')).map(Key => ({ Key }))
    },
    async deleteObjects(bucket: string, paths: string[]) {
      expect(bucket).toBe('assets')
      for (const path of paths) keys.delete(path)
    },
  }
  return { keys, adapter: new S3StorageAdapter(client as unknown as ConstructorParameters<typeof S3StorageAdapter>[0], { bucket: 'assets', prefix }) }
}

test('deleting the unprefixed S3 root removes every root object', async () => {
  const { keys, adapter } = disk()
  await adapter.deleteDirectory('')
  expect([...keys]).toEqual([])
})

test('deleting a prefixed S3 root preserves objects outside that directory', async () => {
  const { keys, adapter } = disk('photos/')
  await adapter.deleteDirectory('')
  expect([...keys].sort()).toEqual(['notes.txt', 'other/file.txt'])
})
