import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Storage } from '../src/facade'
import { localDiskRoot, locateFile } from '../src/locate'

const roots: string[] = []
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

describe('locating a stored file to serve', () => {
  test('a local disk answers a lazy file by path; the next disk is tried when the first lacks it', async () => {
    const first = mkdtempSync(join(tmpdir(), 'locate-a-'))
    const second = mkdtempSync(join(tmpdir(), 'locate-b-'))
    roots.push(first, second)
    mkdirSync(join(second, 'videos'), { recursive: true })
    writeFileSync(join(second, 'videos/clip.mp4'), new Uint8Array([1, 2, 3, 4]))
    Storage.configure('locate-a', { driver: 'local', root: first } as never)
    Storage.configure('locate-b', { driver: 'local', root: second } as never)
    expect(localDiskRoot('locate-a')).toBe(first)

    const found = await locateFile('videos/clip.mp4', { disks: ['locate-a', 'locate-b'] })
    expect(found).toMatchObject({ kind: 'file', disk: 'locate-b', path: join(second, 'videos/clip.mp4') })
    expect(new Uint8Array(await (found as { file: Blob }).file.slice(1, 3).arrayBuffer())).toEqual(new Uint8Array([2, 3]))
    expect(await locateFile('videos/missing.mp4', { disks: ['locate-a', 'locate-b'] })).toBeNull()
  })

  test('a disk with no local root answers a temporary URL, and one that throws is passed over', async () => {
    const memory = { fileExists: async () => true, temporaryUrl: async (path: string, options: { expiresIn: number }) => `https://bucket.example/${path}?e=${options.expiresIn}` }
    const broken = { fileExists: async () => { throw new Error('unreachable') } }
    const originalDisk = Storage.disk.bind(Storage)
    const originalConfig = Storage.getDiskConfig.bind(Storage)
    Storage.disk = ((name?: string) => name === 'bucket' ? memory : name === 'broken' ? broken : originalDisk(name as never)) as typeof Storage.disk
    Storage.getDiskConfig = ((name?: string) => name === 'bucket' || name === 'broken' ? { driver: 's3' } : originalConfig(name)) as typeof Storage.getDiskConfig
    try {
      expect(localDiskRoot('bucket')).toBeNull()
      expect(await locateFile('videos/clip.mp4', { disks: ['broken', 'bucket'], expiresIn: 60 })).toEqual({ kind: 'url', disk: 'bucket', url: 'https://bucket.example/videos/clip.mp4?e=60' })
    }
    finally {
      Storage.disk = originalDisk
      Storage.getDiskConfig = originalConfig
    }
  })
})
