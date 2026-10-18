import { expect, test } from 'bun:test'
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeCompletedArtifact } from '../src/completed-artifact-directory'

test('completed artifacts snapshot bytes, publish private complete files and never overwrite another artifact', async () => {
  const root = await mkdtemp(join(tmpdir(), 'completed-artifact-'))
  try {
    const target = join(root, 'artifact'), bytes = new Uint8Array([1, 2, 3])
    const pending = writeCompletedArtifact(target, [{ path: 'images/a.bin', contents: bytes }, { path: 'report.json', contents: '{"ok":true}\n' }], '{"version":1}\n')
    bytes.fill(0)
    const output = await pending
    expect(output.directory).toBe(target)
    expect(Array.from(await readFile(join(target, 'images/a.bin')))).toEqual([1, 2, 3])
    expect(JSON.parse(await readFile(output.manifest, 'utf8'))).toEqual({ version: 1 })
    expect(await readdir(target)).not.toContain('manifest.pending.json')
    expect((await stat(target)).mode & 0o777).toBe(0o700)
    expect((await stat(output.manifest)).mode & 0o777).toBe(0o600)
    await expect(writeCompletedArtifact(target, [], '{"version":2}')).rejects.toThrow('EEXIST')
    expect(JSON.parse(await readFile(output.manifest, 'utf8'))).toEqual({ version: 1 })
  }
  finally { await rm(root, { recursive: true, force: true }) }
})

test('Buffer views are copied before asynchronous publication', async () => {
  const root = await mkdtemp(join(tmpdir(), 'artifact-buffer-'))
  try {
    const bytes = Buffer.from([4, 5, 6])
    const pending = writeCompletedArtifact(join(root, 'data'), [{ path: 'bytes.bin', contents: bytes }], '{}')
    bytes.fill(0)
    await pending
    expect(Array.from(await readFile(join(root, 'data/bytes.bin')))).toEqual([4, 5, 6])
  }
  finally { await rm(root, { recursive: true, force: true }) }
})

test('invalid paths, collisions, shared bytes and malformed manifests fail before creating a directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'artifact-paths-'))
  try {
    const bad = [
      [{ path: '../outside', contents: '' }],
      [{ path: '/absolute', contents: '' }],
      [{ path: 'a//b', contents: '' }],
      [{ path: 'a', contents: '' }, { path: 'a/b', contents: '' }],
      [{ path: 'A.bin', contents: '' }, { path: 'a.bin', contents: '' }],
      [{ path: 'manifest.json', contents: '{}' }],
      [{ path: 'manifest.pending.json', contents: '{}' }],
      [{ path: 'shared.bin', contents: new Uint8Array(new SharedArrayBuffer(1)) }],
    ]
    for (const [i, entries] of bad.entries()) {
      const path = join(root, `bad-${i}`)
      await expect(writeCompletedArtifact(path, entries, '{}')).rejects.toThrow()
      await expect(stat(path)).rejects.toThrow('ENOENT')
    }
    await expect(writeCompletedArtifact(join(root, 'bad-json'), [], '{private')).rejects.toThrow('manifest')
    await expect(writeCompletedArtifact(join(root, 'array-json'), [], '[]')).rejects.toThrow('object')
  }
  finally { await rm(root, { recursive: true, force: true }) }
})

test('an explicitly empty artifact directory exists before its completion manifest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'artifact-empty-'))
  try {
    const result = await writeCompletedArtifact(join(root, 'data'), [], '{}', { directories: ['images'] })
    expect(await readdir(join(result.directory, 'images'))).toEqual([])
    expect((await stat(join(result.directory, 'images'))).mode & 0o777).toBe(0o700)
    await expect(writeCompletedArtifact(join(root, 'bad'), [{ path: 'a', contents: '' }], '{}', { directories: ['a/b'] })).rejects.toThrow('collision')
    await expect(stat(join(root, 'bad'))).rejects.toThrow('ENOENT')
  }
  finally { await rm(root, { recursive: true, force: true }) }
})
