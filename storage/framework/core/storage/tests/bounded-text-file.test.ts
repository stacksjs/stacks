import type { Stats } from 'node:fs'
import type { FileHandle } from 'node:fs/promises'
import { constants as bufferConstants } from 'node:buffer'
import { appendFileSync, fstatSync, mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { open } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'
import { readBoundedTextFile } from '../src/bounded-text-file'

// This public function seam catches local file validation and byte limits;
// it does not authorize paths or validate an application's document schema.
let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'stacks-bounded-text-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

test('reads complete UTF-8 text at an exact byte limit', async () => {
  const file = join(root, 'text.txt')
  writeFileSync(file, 'café')
  expect(await readBoundedTextFile(file, { maxBytes: 5 })).toBe('café')
})

test('allows empty files with a zero-byte limit', async () => {
  const file = join(root, 'empty.txt')
  writeFileSync(file, '')
  expect(await readBoundedTextFile(file, { maxBytes: 0 })).toBe('')
})

test('rejects files exceeding the encoded byte limit', async () => {
  const file = join(root, 'text.txt')
  writeFileSync(file, 'café')
  await expect(readBoundedTextFile(file, { maxBytes: 4 })).rejects.toMatchObject({
    name: 'BoundedTextFileError',
    code: 'FILE_TOO_LARGE',
  })
})

test('rejects invalid UTF-8 rather than replacing malformed bytes', async () => {
  const file = join(root, 'text.txt')
  for (const bytes of [[0xC3, 0x28], [0xE2, 0x82], [0xC0, 0xAF]]) {
    writeFileSync(file, new Uint8Array(bytes))
    await expect(readBoundedTextFile(file, { maxBytes: 10 })).rejects.toMatchObject({ code: 'INVALID_UTF8' })
  }
})

test('rejects directories and final-component symlinks', async () => {
  const file = join(root, 'text.txt')
  const link = join(root, 'link.txt')
  writeFileSync(file, 'text')
  symlinkSync(file, link)
  await expect(readBoundedTextFile(root, { maxBytes: 100 })).rejects.toMatchObject({ code: 'NOT_REGULAR_FILE' })
  await expect(readBoundedTextFile(link, { maxBytes: 100 })).rejects.toMatchObject({ code: 'ELOOP' })
})

test('rejects a FIFO without waiting for a writer', async () => {
  const fifo = join(root, 'pipe')
  expect(Bun.spawnSync(['mkfifo', fifo]).exitCode).toBe(0)
  // Run in a child so a regression cannot leave a blocked thread in this suite.
  const child = Bun.spawn([process.execPath, '-e', `
    import { readBoundedTextFile } from ${JSON.stringify(join(import.meta.dir, '../src/bounded-text-file.ts'))};
    try { await readBoundedTextFile(process.argv[1], { maxBytes: 100 }); process.exit(2) }
    catch (error) { process.exit(error.code === 'NOT_REGULAR_FILE' ? 0 : 3) }
  `, fifo], { stdout: 'pipe', stderr: 'pipe' })
  const timer = setTimeout(() => child.kill(), 2000)
  try {
    expect(await child.exited).toBe(0)
  }
  finally {
    clearTimeout(timer)
    child.kill()
  }
})

test('validates byte limits before opening a file', async () => {
  for (const maxBytes of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER, bufferConstants.MAX_LENGTH])
    await expect(readBoundedTextFile(join(root, 'missing'), { maxBytes })).rejects.toBeInstanceOf(RangeError)
})

test('propagates native missing-file errors', async () => {
  await expect(readBoundedTextFile(join(root, 'missing'), { maxBytes: 1 })).rejects.toMatchObject({ code: 'ENOENT' })
})

// Control the filesystem race immediately after a real descriptor stat. All
// metadata and reads remain real; no fabricated bytes can bypass the guard.
async function afterDescriptorStat(file: string, change: (fd: number) => void): Promise<() => void> {
  const handle = await open(file, 'r')
  const prototype = Object.getPrototypeOf(handle) as { stat: () => Promise<Stats> }
  const original = prototype.stat
  await handle.close()
  const spy = spyOn(prototype, 'stat').mockImplementationOnce(async function (this: FileHandle) {
    const stat = await original.call(this)
    change(this.fd)
    return stat
  })
  return () => spy.mockRestore()
}

test('rejects growth beyond the limit after the descriptor size check', async () => {
  const file = join(root, 'growing.txt')
  writeFileSync(file, 'a')
  const restore = await afterDescriptorStat(file, () => appendFileSync(file, 'bcde'))
  try {
    await expect(readBoundedTextFile(file, { maxBytes: 4 })).rejects.toMatchObject({ code: 'FILE_TOO_LARGE' })
  }
  finally {
    restore()
  }
})

test('closes the descriptor after successful reads and validation failures', async () => {
  const file = join(root, 'text.txt')
  for (const bytes of [new Uint8Array([0x61]), new Uint8Array([0xFF]), new Uint8Array([0x61, 0x62])]) {
    writeFileSync(file, bytes)
    let descriptor = -1
    const restore = await afterDescriptorStat(file, (fd) => { descriptor = fd })
    try {
      await readBoundedTextFile(file, { maxBytes: 1 }).catch(() => {})
      expect(descriptor).toBeGreaterThanOrEqual(0)
      expect(() => fstatSync(descriptor)).toThrow(/bad file descriptor/i)
    }
    finally {
      restore()
    }
  }
})

test('continues reading the opened file when the path is replaced', async () => {
  const file = join(root, 'original.txt')
  writeFileSync(file, 'original')
  const restore = await afterDescriptorStat(file, () => {
    renameSync(file, join(root, 'renamed.txt'))
    writeFileSync(file, 'replacement')
  })
  try {
    expect(await readBoundedTextFile(file, { maxBytes: 8 })).toBe('original')
  }
  finally {
    restore()
  }
})
