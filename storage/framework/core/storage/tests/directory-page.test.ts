import { afterEach, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { LocalStorageAdapter } from '../src/adapters/local'
import { BunStorageAdapter } from '../src/adapters/bun'
import { DirectoryListingChangedError } from '../src/directory-page'
const roots: string[] = []
afterEach(async () => { for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true }) })
for (const Adapter of [LocalStorageAdapter, BunStorageAdapter]) {
  test.skipIf(!['darwin', 'linux'].includes(process.platform))(`${Adapter.name}: restartable bounded directory pages`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'storage-page-')); roots.push(root)
    for (let index = 0; index < 161; index++) await writeFile(join(root, `${index}-${"x".repeat(200)}.png`), 'image')
    const found: string[] = []
    let cursor: string | null = null
    let pages = 0
    do {
      // No adapter or native directory handle survives a page.
      const page = await new Adapter({ root }).listPage('', { cursor, limit: 13 })
      expect(page.entries.length).toBeLessThanOrEqual(13)
      found.push(...page.entries.map(entry => entry.path))
      cursor = page.nextCursor
      if (++pages > 30) throw new Error('Cursor did not advance')
    } while (cursor)
    expect(new Set(found).size).toBe(161)
    expect(found.length).toBe(161)
    const first = await new Adapter({ root }).listPage('', { limit: 5 })
    const corrupt = JSON.parse(Buffer.from(first.nextCursor!, 'base64url').toString())
    corrupt.skip = 32767
    await expect(new Adapter({ root }).listPage('', { cursor: Buffer.from(JSON.stringify(corrupt)).toString('base64url') })).rejects.toThrow('cursor boundary')
    await writeFile(join(root, 'added.png'), 'new')
    await expect(new Adapter({ root }).listPage('', { cursor: first.nextCursor })).rejects.toBeInstanceOf(DirectoryListingChangedError)
    expect((await new Adapter({ root }).listPage('missing')).nextCursor).toBeNull()
    await expect(new Adapter({ root }).listPage('', { limit: 1001 })).rejects.toThrow('limit')
    await expect(new Adapter({ root }).listPage('', { cursor: 'garbage' })).rejects.toThrow('cursor')
  })
}
