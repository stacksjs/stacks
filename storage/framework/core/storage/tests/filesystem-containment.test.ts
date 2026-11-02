import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BunStorageAdapter } from '../src/adapters/bun'
import { LocalStorageAdapter } from '../src/adapters/local'

let directory: string
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'stacks-containment-'))
  await mkdir(join(directory, 'root'))
  await mkdir(join(directory, 'outside'))
  await writeFile(join(directory, 'outside', 'secret.txt'), 'outside')
})
afterEach(async () => { await rm(directory, { recursive: true, force: true }) })

for (const [name, Adapter] of [['local', LocalStorageAdapter], ['bun', BunStorageAdapter]] as const) {
  describe(`${name} disk containment`, () => {
    test('rejects directory and file symlinks inside the storage root', async () => {
      const disk = new Adapter({ root: join(directory, 'root') })
      await symlink(join(directory, 'outside'), join(directory, 'root', 'link'))
      await symlink(join(directory, 'outside', 'secret.txt'), join(directory, 'root', 'file-link'))
      await expect(disk.readToString('link/secret.txt')).rejects.toThrow(/symlink/i)
      await expect(disk.readToString('file-link')).rejects.toThrow(/symlink/i)
      await expect(disk.write('link/secret.txt', 'changed')).rejects.toThrow(/symlink/i)
      await expect(disk.deleteFile('link/secret.txt')).rejects.toThrow(/symlink/i)
      await expect(disk.copyFile('link/secret.txt', 'copy.txt')).rejects.toThrow(/symlink/i)
      expect(await readFile(join(directory, 'outside', 'secret.txt'), 'utf8')).toBe('outside')
    })

    test('allows two-dot filenames while rejecting parent traversal', async () => {
      const disk = new Adapter({ root: join(directory, 'root') })
      await disk.write('..backup.txt', 'backup')
      expect(await disk.readToString('..backup.txt')).toBe('backup')
      await expect(disk.write('../escape.txt', 'escape')).rejects.toThrow(/traversal/i)
    })
  })
}
