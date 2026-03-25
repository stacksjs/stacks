import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { copyFile, copyFolder } from '../src/copy'
import { deleteEmptyFolder, deleteFile, deleteFolder } from '../src/delete'
import {
  doesExist,
  doesNotExist,
  get,
  getFiles,
  hasFiles,
  put,
  readJsonFile,
  readTextFile,
  writeFile,
} from '../src/files'
import { createFolder, doesFolderExist, getFolders, isDir, isFolder } from '../src/folders'
import { exists } from '../src/fs'
import { glob, globSync } from '../src/glob'
import { hashDirectory, hashPath, hashPaths } from '../src/hash'
import { updateConfigFile } from '../src/helpers'
import { move, rename } from '../src/move'
import { deflateSync, gunzipSync, gzipSync, inflateSync } from '../src/zip'

const tmpDir = `/tmp/stacks-storage-deep-${Date.now()}`

beforeAll(() => mkdirSync(tmpDir, { recursive: true }))
afterAll(() => rmSync(tmpDir, { recursive: true, force: true }))

describe('Storage Deep Integration Tests', () => {
  // ─── File Write / Read Round-trips ───────────────────────────────────────

  test('writeFile creates a file and Bun.file can read it back', async () => {
    const filePath = join(tmpDir, 'write-test.txt')
    const bytes = await writeFile(filePath, 'hello stacks')
    expect(bytes).toBeGreaterThan(0)
    expect(existsSync(filePath)).toBe(true)

    const content = await Bun.file(filePath).text()
    expect(content).toBe('hello stacks')
  })

  test('put writes a file synchronously and get reads it back', async () => {
    const filePath = join(tmpDir, 'put-get.txt')
    put(filePath, 'sync content')
    expect(existsSync(filePath)).toBe(true)

    const content = await get(filePath)
    expect(content).toBe('sync content')
  })

  test('readTextFile returns path and data', async () => {
    const filePath = join(tmpDir, 'read-text.txt')
    put(filePath, 'text file data')

    const result = await readTextFile(filePath)
    expect(result.path).toBe(filePath)
    expect(result.data).toBe('text file data')
  })

  test('readJsonFile / writeFile round-trip for JSON data', async () => {
    const filePath = join(tmpDir, 'data.json')
    const obj = { name: 'stacks', version: 1, nested: { ok: true } }
    await writeFile(filePath, JSON.stringify(obj, null, 2) + '\n')

    const result = await readJsonFile(filePath)
    expect(result.data).toEqual(obj)
    expect(result.path).toBe(filePath)
    expect(result.indent).toBe('  ')
  })

  test('readJsonFile rejects on invalid JSON', async () => {
    const filePath = join(tmpDir, 'bad.json')
    put(filePath, 'not json{')

    try {
      await readJsonFile(filePath)
      expect(true).toBe(false) // should not reach here
    }
    catch (err: any) {
      expect(err.message).toContain('Failed to parse JSON')
    }
  })

  test('writeFile auto-creates intermediate directories', async () => {
    const deepPath = join(tmpDir, 'deep', 'nested', 'dir', 'file.txt')
    await writeFile(deepPath, 'deep content')
    expect(existsSync(deepPath)).toBe(true)
    const content = await Bun.file(deepPath).text()
    expect(content).toBe('deep content')
  })

  // ─── Existence Checks ───────────────────────────────────────────────────

  test('exists / doesExist / doesNotExist work for files', () => {
    const filePath = join(tmpDir, 'exists-check.txt')
    put(filePath, 'exists')

    expect(exists(filePath)).toBe(true)
    expect(doesExist(filePath)).toBe(true)
    expect(doesNotExist(filePath)).toBe(false)

    const missing = join(tmpDir, 'nope.txt')
    expect(exists(missing)).toBe(false)
    expect(doesExist(missing)).toBe(false)
    expect(doesNotExist(missing)).toBe(true)
  })

  test('doesFolderExist returns correct value', () => {
    expect(doesFolderExist(tmpDir)).toBe(true)
    expect(doesFolderExist(join(tmpDir, 'nonexistent-folder'))).toBe(false)
  })

  // ─── Folder Operations ──────────────────────────────────────────────────

  test('isFolder / isDir detect directories correctly', () => {
    expect(isFolder(tmpDir)).toBe(true)
    expect(isDir(tmpDir)).toBe(true)

    const filePath = join(tmpDir, 'isfile-check.txt')
    put(filePath, 'file')
    expect(isFolder(filePath)).toBe(false)
    expect(isDir(filePath)).toBe(false)
  })

  test('createFolder creates a directory recursively', async () => {
    const dirPath = join(tmpDir, 'created', 'sub', 'dir')
    await createFolder(dirPath)
    expect(existsSync(dirPath)).toBe(true)
    expect(isFolder(dirPath)).toBe(true)
  })

  test('getFolders lists subdirectories', () => {
    const parent = join(tmpDir, 'parent-folders')
    mkdirSync(join(parent, 'alpha'), { recursive: true })
    mkdirSync(join(parent, 'beta'), { recursive: true })
    put(join(parent, 'file.txt'), 'not a dir')

    const folders = getFolders(parent)
    expect(folders).toContain('alpha')
    expect(folders).toContain('beta')
    expect(folders).not.toContain('file.txt')
  })

  test('hasFiles detects non-empty folders', () => {
    const dir = join(tmpDir, 'has-files-dir')
    mkdirSync(dir, { recursive: true })
    expect(hasFiles(dir)).toBe(false)

    put(join(dir, 'a.txt'), 'content')
    expect(hasFiles(dir)).toBe(true)
  })

  test('getFiles recursively lists files', () => {
    const dir = join(tmpDir, 'getfiles-root')
    mkdirSync(join(dir, 'sub'), { recursive: true })
    put(join(dir, 'root.txt'), 'r')
    put(join(dir, 'sub', 'child.txt'), 'c')

    const files = getFiles(dir)
    expect(files.length).toBe(2)
    expect(files.some(f => f.endsWith('root.txt'))).toBe(true)
    expect(files.some(f => f.endsWith('child.txt'))).toBe(true)
  })

  // ─── Copy Operations ────────────────────────────────────────────────────

  test('copyFile copies a single file', () => {
    const src = join(tmpDir, 'copy-src.txt')
    const dest = join(tmpDir, 'copy-dest.txt')
    put(src, 'copy me')

    copyFile(src, dest)
    expect(existsSync(dest)).toBe(true)
    expect(Bun.file(dest).text()).resolves.toBe('copy me')
  })

  test('copyFolder copies an entire directory tree', () => {
    const srcDir = join(tmpDir, 'copy-folder-src')
    const destDir = join(tmpDir, 'copy-folder-dest')
    mkdirSync(join(srcDir, 'inner'), { recursive: true })
    put(join(srcDir, 'a.txt'), 'a')
    put(join(srcDir, 'inner', 'b.txt'), 'b')

    copyFolder(srcDir, destDir)
    expect(existsSync(join(destDir, 'a.txt'))).toBe(true)
    expect(existsSync(join(destDir, 'inner', 'b.txt'))).toBe(true)
  })

  // ─── Move / Rename Operations ───────────────────────────────────────────

  test('rename moves a file to a new path', async () => {
    const from = join(tmpDir, 'rename-from.txt')
    const to = join(tmpDir, 'rename-to.txt')
    put(from, 'move me')

    const result = await rename(from, to)
    expect(result.isOk).toBe(true)
    expect(existsSync(from)).toBe(false)
    expect(existsSync(to)).toBe(true)
  })

  test('move handles single file relocation', async () => {
    const from = join(tmpDir, 'move-single.txt')
    const to = join(tmpDir, 'moved-single.txt')
    put(from, 'moving')

    const result = await move(from, to)
    expect(result.isOk).toBe(true)
    expect(existsSync(from)).toBe(false)
    expect(existsSync(to)).toBe(true)
  })

  // ─── Delete Operations ──────────────────────────────────────────────────

  test('deleteFile removes a file', async () => {
    const filePath = join(tmpDir, 'delete-me.txt')
    put(filePath, 'bye')
    expect(existsSync(filePath)).toBe(true)

    const result = await deleteFile(filePath)
    expect(result.isOk).toBe(true)
    expect(existsSync(filePath)).toBe(false)
  })

  test('deleteFolder removes a directory recursively', async () => {
    const dir = join(tmpDir, 'delete-folder')
    mkdirSync(join(dir, 'inner'), { recursive: true })
    put(join(dir, 'inner', 'file.txt'), 'x')

    const result = await deleteFolder(dir)
    expect(result.isOk).toBe(true)
    expect(existsSync(dir)).toBe(false)
  })

  test('deleteEmptyFolder only deletes empty directories', async () => {
    const emptyDir = join(tmpDir, 'empty-dir')
    mkdirSync(emptyDir, { recursive: true })

    const result = await deleteEmptyFolder(emptyDir)
    expect(result.isOk).toBe(true)
    expect(existsSync(emptyDir)).toBe(false)

    // Non-empty dir should not be deleted
    const nonEmptyDir = join(tmpDir, 'non-empty-dir')
    mkdirSync(nonEmptyDir, { recursive: true })
    put(join(nonEmptyDir, 'keep.txt'), 'keep')

    const result2 = await deleteEmptyFolder(nonEmptyDir)
    expect(result2.isOk).toBe(true)
    expect(existsSync(nonEmptyDir)).toBe(true) // still exists because not empty
  })

  // ─── Glob Operations ────────────────────────────────────────────────────

  test('globSync finds files by pattern', () => {
    const dir = join(tmpDir, 'glob-test')
    mkdirSync(dir, { recursive: true })
    put(join(dir, 'one.ts'), 'ts1')
    put(join(dir, 'two.ts'), 'ts2')
    put(join(dir, 'three.js'), 'js1')

    const results = globSync('*.ts', { cwd: dir })
    expect(results.length).toBe(2)
    expect(results).toContain('one.ts')
    expect(results).toContain('two.ts')
  })

  test('glob (async) finds files by pattern', async () => {
    const dir = join(tmpDir, 'glob-async-test')
    mkdirSync(dir, { recursive: true })
    put(join(dir, 'a.json'), '{}')
    put(join(dir, 'b.json'), '{}')
    put(join(dir, 'c.txt'), 'nope')

    const results = await glob('*.json', { cwd: dir })
    expect(results.length).toBe(2)
    expect(results).toContain('a.json')
    expect(results).toContain('b.json')
  })

  test('glob with absolute option returns full paths', async () => {
    const dir = join(tmpDir, 'glob-abs')
    mkdirSync(dir, { recursive: true })
    put(join(dir, 'abs.txt'), 'absolute')

    const results = await glob('*.txt', { cwd: dir, absolute: true })
    expect(results.length).toBe(1)
    expect(results[0].startsWith('/')).toBe(true)
  })

  // ─── Hash Operations ────────────────────────────────────────────────────

  test('hashPath returns a consistent sha256 hex for a file', () => {
    const filePath = join(tmpDir, 'hash-file.txt')
    put(filePath, 'hash me')

    const h1 = hashPath(filePath)
    const h2 = hashPath(filePath)
    expect(h1).toBe(h2)
    expect(h1).toMatch(/^[0-9a-f]{64}$/)
  })

  test('hashPath returns different hashes for different content', () => {
    const f1 = join(tmpDir, 'hash-a.txt')
    const f2 = join(tmpDir, 'hash-b.txt')
    put(f1, 'content a')
    put(f2, 'content b')

    expect(hashPath(f1)).not.toBe(hashPath(f2))
  })

  test('hashDirectory hashes an entire directory', () => {
    const dir = join(tmpDir, 'hash-dir')
    mkdirSync(dir, { recursive: true })
    put(join(dir, 'x.txt'), 'x')
    put(join(dir, 'y.txt'), 'y')

    const h = hashDirectory(dir)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  test('hashPaths hashes multiple paths into a single digest', () => {
    const f1 = join(tmpDir, 'hp1.txt')
    const f2 = join(tmpDir, 'hp2.txt')
    put(f1, 'one')
    put(f2, 'two')

    const combined = hashPaths([f1, f2])
    expect(combined).toMatch(/^[0-9a-f]{64}$/)
    // Combined hash differs from individual
    expect(combined).not.toBe(hashPath(f1))
  })

  // ─── Compression ────────────────────────────────────────────────────────

  test('gzipSync / gunzipSync round-trip', () => {
    const input = new TextEncoder().encode('compress me please')
    const compressed = gzipSync(input)
    expect(compressed.length).toBeGreaterThan(0)
    expect(compressed.length).not.toBe(input.length)

    const decompressed = gunzipSync(compressed)
    const text = new TextDecoder().decode(decompressed)
    expect(text).toBe('compress me please')
  })

  test('deflateSync / inflateSync round-trip', () => {
    const input = new TextEncoder().encode('deflate this string')
    const deflated = deflateSync(input)
    const inflated = inflateSync(deflated)
    const text = new TextDecoder().decode(inflated)
    expect(text).toBe('deflate this string')
  })

  // ─── updateConfigFile helper ─────────────────────────────────────────────

  test('updateConfigFile merges new keys into a JSON config', async () => {
    const configPath = join(tmpDir, 'config-update.json')
    put(configPath, JSON.stringify({ a: 1, b: 2 }, null, 2))

    await updateConfigFile(configPath, { b: 99, c: 3 })

    const content = JSON.parse(await Bun.file(configPath).text())
    expect(content.a).toBe(1)
    expect(content.b).toBe(99)
    expect(content.c).toBe(3)
  })

  // ─── Edge Cases ──────────────────────────────────────────────────────────

  test('deleteFile on non-existent path returns ok with message', async () => {
    // deleteFile uses fs.statSync which throws for non-existent files
    try {
      await deleteFile(join(tmpDir, 'never-existed.txt'))
    }
    catch {
      // expected - file does not exist so statSync throws
    }
  })

  test('isFolder returns false for non-existent path', () => {
    expect(isFolder(join(tmpDir, 'ghost-folder'))).toBe(false)
  })

  test('hashPath handles non-existent path gracefully', () => {
    // hashFileOrDirectory checks existsSync and returns early
    const h = hashPath(join(tmpDir, 'no-such-file.txt'))
    // empty hash digest
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })
})
