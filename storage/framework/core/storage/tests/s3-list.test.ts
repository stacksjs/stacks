/**
 * A shallow `list()` on an S3 disk is one directory, as on every other disk.
 *
 * It listed without a delimiter, so `list('photos')` returned every object
 * under `photos/` at any depth, as if all of them sat directly in it, and no
 * folder at all. The local and memory disks list one level, files and
 * directories, so code written against them saw a different tree on S3.
 *
 * The client below answers ListObjectsV2 the way S3 does for the keys given,
 * honouring the prefix, the delimiter and pagination.
 */

import { describe, expect, it } from 'bun:test'
import { S3StorageAdapter } from '../src/adapters/s3'

const keys = [
  'photos/',
  'photos/cover.jpg',
  'photos/2024/a.jpg',
  'photos/2024/deep/b.jpg',
  'photos/2025/c.jpg',
  'notes.txt',
]

function bucket(pageSize = 1000) {
  const requests: Array<Record<string, unknown>> = []
  const client = {
    async listObjects(options: { prefix?: string, delimiter?: string, continuationToken?: string }) {
      requests.push(options)
      const prefix = options.prefix ?? ''
      const entries: Array<{ object?: string, folder?: string }> = []
      const seen = new Set<string>()
      for (const key of keys.filter(key => key.startsWith(prefix)).sort()) {
        const rest = key.slice(prefix.length)
        const cut = options.delimiter ? rest.indexOf(options.delimiter) : -1
        // Anything with a delimiter past the prefix rolls up into a folder.
        if (cut >= 0) {
          const folder = prefix + rest.slice(0, cut + 1)
          if (!seen.has(folder)) {
            seen.add(folder)
            entries.push({ folder })
          }
        }
        else {
          entries.push({ object: key })
        }
      }
      const start = Number(options.continuationToken ?? 0)
      const page = entries.slice(start, start + pageSize)
      return {
        objects: page.filter(entry => entry.object).map(entry => ({ Key: entry.object!, LastModified: '', Size: 1 })),
        commonPrefixes: page.filter(entry => entry.folder).map(entry => entry.folder!),
        nextContinuationToken: start + pageSize < entries.length ? String(start + pageSize) : undefined,
      }
    },
    async listAllObjects(options: { prefix?: string }) {
      return keys.filter(key => key.startsWith(options.prefix ?? '')).map(key => ({ Key: key, LastModified: '', Size: 1 }))
    },
  }
  return { adapter: new S3StorageAdapter(client as any, { bucket: 'assets' } as any), requests }
}

async function collect(listing: AsyncIterable<{ path: string, type: string }>): Promise<string[]> {
  const out: string[] = []
  for await (const entry of listing)
    out.push(`${entry.type}:${entry.path}`)
  return out.sort()
}

describe('S3StorageAdapter.list', () => {
  it('lists one directory: its files and its folders', async () => {
    const { adapter, requests } = bucket()

    expect(await collect(adapter.list('photos'))).toEqual([
      'directory:photos/2024',
      'directory:photos/2025',
      'file:photos/cover.jpg',
    ])
    expect(requests[0]).toMatchObject({ prefix: 'photos/', delimiter: '/' })
  })

  it('lists the bucket root the same way', async () => {
    const { adapter } = bucket()
    expect(await collect(adapter.list(''))).toEqual(['directory:photos', 'file:notes.txt'])
  })

  it('follows pagination across files and folders', async () => {
    const { adapter, requests } = bucket(1)
    expect(await collect(adapter.list('photos'))).toEqual([
      'directory:photos/2024',
      'directory:photos/2025',
      'file:photos/cover.jpg',
    ])
    expect(requests.length).toBeGreaterThan(1)
  })

  it('a deep list is still every object beneath', async () => {
    const { adapter } = bucket()
    expect(await collect(adapter.list('photos', { deep: true }))).toContain('file:photos/2024/deep/b.jpg')
  })
})
