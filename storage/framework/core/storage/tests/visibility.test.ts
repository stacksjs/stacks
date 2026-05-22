import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { lstatSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BunStorageAdapter } from '../src/adapters/bun'
import { LocalStorageAdapter } from '../src/adapters/local'
import { Visibility } from '../src/types'

const PUBLIC = 'public' as Visibility
const PRIVATE = 'private' as Visibility

describe('LocalStorageAdapter visibility (stacksjs/stacks#1873 S-4)', () => {
  const testRoot = join(tmpdir(), `stacks-vis-test-${Date.now()}`)
  let adapter: LocalStorageAdapter

  beforeEach(() => {
    mkdirSync(testRoot, { recursive: true })
    adapter = new LocalStorageAdapter({ root: testRoot })
  })

  afterEach(() => {
    try {
      rmSync(testRoot, { recursive: true, force: true })
    }
    catch {
      // ignore cleanup errors
    }
  })

  test('changeVisibility(public) applies 0o644 to files', async () => {
    await adapter.write('public.txt', 'hello')
    await adapter.changeVisibility('public.txt', PUBLIC)

    const mode = lstatSync(join(testRoot, 'public.txt')).mode & 0o777
    expect(mode).toBe(0o644)
  })

  test('changeVisibility(private) applies 0o600 to files', async () => {
    await adapter.write('private.txt', 'hello')
    await adapter.changeVisibility('private.txt', PRIVATE)

    const mode = lstatSync(join(testRoot, 'private.txt')).mode & 0o777
    expect(mode).toBe(0o600)
  })

  test('changeVisibility(public) applies 0o755 to directories', async () => {
    await adapter.createDirectory('subdir')
    await adapter.changeVisibility('subdir', PUBLIC)

    const mode = lstatSync(join(testRoot, 'subdir')).mode & 0o777
    expect(mode).toBe(0o755)
  })

  test('changeVisibility(private) applies 0o700 to directories', async () => {
    await adapter.createDirectory('subdir')
    await adapter.changeVisibility('subdir', PRIVATE)

    const mode = lstatSync(join(testRoot, 'subdir')).mode & 0o777
    expect(mode).toBe(0o700)
  })

  test('visibility() reads back public after changeVisibility(public)', async () => {
    await adapter.write('hello.txt', 'world')
    await adapter.changeVisibility('hello.txt', PUBLIC)

    expect(await adapter.visibility('hello.txt')).toBe(PUBLIC)
  })

  test('visibility() reads back private after changeVisibility(private)', async () => {
    await adapter.write('hello.txt', 'world')
    await adapter.changeVisibility('hello.txt', PRIVATE)

    expect(await adapter.visibility('hello.txt')).toBe(PRIVATE)
  })

  test('visibility() round-trips with the canonical write→chmod→read cycle', async () => {
    await adapter.write('a.txt', 'a')
    await adapter.changeVisibility('a.txt', PUBLIC)
    await adapter.changeVisibility('a.txt', PRIVATE)
    expect(await adapter.visibility('a.txt')).toBe(PRIVATE)

    await adapter.changeVisibility('a.txt', PUBLIC)
    expect(await adapter.visibility('a.txt')).toBe(PUBLIC)
  })

  test('changeVisibility on a non-existent file throws', async () => {
    await expect(adapter.changeVisibility('missing.txt', PUBLIC)).rejects.toThrow()
  })
})

describe('BunStorageAdapter visibility (stacksjs/stacks#1873 S-4)', () => {
  const testRoot = join(tmpdir(), `stacks-vis-bun-test-${Date.now()}`)
  let adapter: BunStorageAdapter

  beforeEach(() => {
    mkdirSync(testRoot, { recursive: true })
    adapter = new BunStorageAdapter({ root: testRoot })
  })

  afterEach(() => {
    try {
      rmSync(testRoot, { recursive: true, force: true })
    }
    catch {
      // ignore cleanup errors
    }
  })

  test('changeVisibility(public) sets 0o644 on files', async () => {
    await adapter.write('public.txt', 'hello')
    await adapter.changeVisibility('public.txt', PUBLIC)

    const mode = lstatSync(join(testRoot, 'public.txt')).mode & 0o777
    expect(mode).toBe(0o644)
  })

  test('round-trip: write → chmod public → visibility() returns public', async () => {
    await adapter.write('hello.txt', 'world')
    await adapter.changeVisibility('hello.txt', PUBLIC)
    expect(await adapter.visibility('hello.txt')).toBe(PUBLIC)

    await adapter.changeVisibility('hello.txt', PRIVATE)
    expect(await adapter.visibility('hello.txt')).toBe(PRIVATE)
  })
})
