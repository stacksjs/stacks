/**
 * The `local` and `bun` disks build URLs, write, delete and report the same
 * way, and every URL they hand out is one something serves.
 *
 * What was wrong, by adapter:
 *
 *   - local `publicUrl()`: a disk served from the site root (`url: '/'`) had
 *     its slash trimmed to `''`, read as unconfigured, and fell through to
 *     `APP_URL`. Paths were not encoded, so `photo #1.jpg` linked to
 *     `photo `.
 *   - local and bun `temporaryUrl()`: `http://localhost/temp/<token>`, which
 *     no route serves on any host. Bun's token was an unsigned base64 of the
 *     path and expiry.
 *   - bun `publicUrl()`: went from `options.domain` straight to localhost,
 *     ignoring the disk's `url` and `APP_URL`.
 *   - bun `stat()`: said `visibility: 'private'` for every file.
 *   - bun `deleteFile()` / `createDirectory()`: shell commands with failures
 *     switched off, so a delete that failed reported success.
 *   - bun `write()` / `putStream()`: wrote in place, and the abort signal went
 *     to a listener that did nothing.
 */

import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { BunStorageAdapter } from '../src/adapters/bun'
import { LocalStorageAdapter } from '../src/adapters/local'
import { verifySignedStorageToken } from '../src/signed-url'

let root: string
const savedAppUrl = process.env.APP_URL

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'stacks-fs-parity-'))
  process.env.APP_URL = 'https://app.example.com'
})

afterEach(() => {
  if (savedAppUrl === undefined)
    delete process.env.APP_URL
  else
    process.env.APP_URL = savedAppUrl
  // A test may have made a directory read-only.
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory())
      chmodSync(join(root, entry.name), 0o755)
  }
  rmSync(root, { recursive: true, force: true })
})

const adapters = {
  local: (url?: string) => new LocalStorageAdapter({ root, url }),
  bun: (url?: string) => new BunStorageAdapter({ root, url }),
}

for (const [name, make] of Object.entries(adapters)) {
  describe(`the ${name} disk`, () => {
    test('publicUrl() uses the disk url, including the site root', async () => {
      expect(await make('/').publicUrl('avatar.png')).toBe('/avatar.png')
      expect(await make('/storage/').publicUrl('avatar.png')).toBe('/storage/avatar.png')
      expect(await make('https://cdn.example.com').publicUrl('avatar.png')).toBe('https://cdn.example.com/avatar.png')
    })

    test('publicUrl() falls back to APP_URL, and an explicit domain wins', async () => {
      expect(await make().publicUrl('avatar.png')).toBe('https://app.example.com/avatar.png')
      expect(await make('/storage').publicUrl('avatar.png', { domain: 'https://other.example.com/' })).toBe('https://other.example.com/avatar.png')
    })

    test('publicUrl() encodes each segment and keeps the slashes', async () => {
      expect(await make('/storage').publicUrl('albums/my photo #1.jpg')).toBe('/storage/albums/my%20photo%20%231.jpg')
    })

    test('temporaryUrl() is a signed /__storage URL the framework verifies', async () => {
      const url = new URL(await make().temporaryUrl('reports/q4 summary.pdf', { expiresIn: 600 }))

      expect(url.origin).toBe('https://app.example.com')
      expect(url.pathname).toBe('/__storage/reports%2Fq4%20summary.pdf')
      expect(verifySignedStorageToken(url.searchParams.get('token')!, 'reports/q4 summary.pdf').valid).toBe(true)
    })

    test('a stream that fails part-way leaves the previous file', async () => {
      writeFileSync(join(root, 'avatar.png'), 'the original')
      let sent = false
      const failing = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (sent)
            return controller.error(new Error('connection reset'))
          sent = true
          controller.enqueue(new TextEncoder().encode('half'))
        },
      })

      await expect(make().putStream('avatar.png', failing)).rejects.toThrow()

      expect(readFileSync(join(root, 'avatar.png'), 'utf8')).toBe('the original')
      expect(readdirSync(root).filter(entry => entry.endsWith('.tmp'))).toEqual([])
    })

    test('an aborted putStream stops, and leaves the previous file', async () => {
      writeFileSync(join(root, 'avatar.png'), 'the original')
      const controller = new AbortController()
      const stalling = new ReadableStream<Uint8Array>({
        start(stream) {
          stream.enqueue(new TextEncoder().encode('part'))
        },
      })

      const upload = make().putStream('avatar.png', stalling, { signal: controller.signal })
      setTimeout(() => controller.abort(), 20)

      await expect(upload).rejects.toThrow()
      expect(readFileSync(join(root, 'avatar.png'), 'utf8')).toBe('the original')
    })

    test('stat() reports the visibility the file has', async () => {
      const disk = make()
      await disk.write('shared.txt', 'x')
      await disk.changeVisibility('shared.txt', 'public')
      expect((await disk.stat('shared.txt')).visibility).toBe('public')
      await disk.changeVisibility('shared.txt', 'private')
      expect((await disk.stat('shared.txt')).visibility).toBe('private')
    })

    test('a delete that fails says so, and a file already gone is fine', async () => {
      const disk = make()
      mkdirSync(join(root, 'locked'))
      writeFileSync(join(root, 'locked', 'kept.txt'), 'x')
      chmodSync(join(root, 'locked'), 0o555)

      await expect(disk.deleteFile('locked/kept.txt')).rejects.toThrow()
      expect(existsSync(join(root, 'locked', 'kept.txt'))).toBe(true)

      await disk.deleteFile('never-existed.txt')
    })

    test('a directory that cannot be created says so', async () => {
      writeFileSync(join(root, 'a-file'), 'x')
      await expect(make().createDirectory('a-file/child')).rejects.toThrow()
    })

    test('move and copy create the destination directory', async () => {
      const disk = make()
      await disk.write('a.txt', 'moved')
      await disk.write('b.txt', 'copied')

      await disk.moveFile('a.txt', 'deep/er/a.txt')
      await disk.copyFile('b.txt', 'deep/b.txt')

      expect(readFileSync(join(root, 'deep/er/a.txt'), 'utf8')).toBe('moved')
      expect(existsSync(join(root, 'a.txt'))).toBe(false)
      expect(readFileSync(join(root, 'deep/b.txt'), 'utf8')).toBe('copied')
    })
  })
}
