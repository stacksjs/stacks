import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { StorageManager } from '../src/facade'

// ---------------------------------------------------------------------------
// Setup a real temp directory for local disk tests
// ---------------------------------------------------------------------------

const testRoot = join(tmpdir(), `stacks-storage-test-${Date.now()}`)
const localRoot = join(testRoot, 'local')
const publicRoot = join(testRoot, 'public')

let storage: InstanceType<typeof StorageManager>

beforeEach(() => {
  mkdirSync(localRoot, { recursive: true })
  mkdirSync(publicRoot, { recursive: true })

  storage = new StorageManager()
  storage.init({
    default: 'local',
    disks: {
      local: {
        driver: 'local',
        root: localRoot,
        visibility: 'private',
      },
      public: {
        driver: 'local',
        root: publicRoot,
        url: '/storage',
        visibility: 'public',
      },
    },
  })
})

afterEach(() => {
  storage.reset()
  try {
    rmSync(testRoot, { recursive: true, force: true })
  }
  catch {
    // ignore cleanup errors
  }
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Storage Facade - put and get', () => {
  test('put() writes a file to the default disk', async () => {
    await storage.put('hello.txt', 'Hello World')
    const content = await storage.get('hello.txt')
    expect(content).toBe('Hello World')
  })

  test('put() handles binary data', async () => {
    const data = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f])
    await storage.put('binary.bin', data)
    const exists = await storage.exists('binary.bin')
    expect(exists).toBe(true)
  })

  test('put() creates nested directories', async () => {
    await storage.put('deep/nested/file.txt', 'nested content')
    const content = await storage.get('deep/nested/file.txt')
    expect(content).toBe('nested content')
  })
})

describe('Storage Facade - exists and missing', () => {
  test('exists() returns true for existing file', async () => {
    await storage.put('check.txt', 'data')
    expect(await storage.exists('check.txt')).toBe(true)
  })

  test('exists() returns false for non-existing file', async () => {
    expect(await storage.exists('nonexistent.txt')).toBe(false)
  })

  test('missing() is inverse of exists()', async () => {
    await storage.put('present.txt', 'data')
    expect(await storage.missing('present.txt')).toBe(false)
    expect(await storage.missing('absent.txt')).toBe(true)
  })
})

describe('Storage Facade - delete', () => {
  test('delete() removes a file', async () => {
    await storage.put('deleteme.txt', 'temp')
    await storage.delete('deleteme.txt')
    expect(await storage.exists('deleteme.txt')).toBe(false)
  })
})

describe('Storage Facade - copy and move', () => {
  test('copy() duplicates a file', async () => {
    await storage.put('original.txt', 'original content')
    await storage.copy('original.txt', 'copied.txt')

    expect(await storage.get('original.txt')).toBe('original content')
    expect(await storage.get('copied.txt')).toBe('original content')
  })

  test('move() relocates a file', async () => {
    await storage.put('before.txt', 'move me')
    await storage.move('before.txt', 'after.txt')

    expect(await storage.exists('before.txt')).toBe(false)
    expect(await storage.get('after.txt')).toBe('move me')
  })
})

describe('Storage Facade - disk selection', () => {
  test('disk() returns the default disk adapter', () => {
    const disk = storage.disk()
    expect(disk).toBeDefined()
    expect(typeof disk.write).toBe('function')
  })

  test('disk("public") returns the public disk adapter', () => {
    const disk = storage.disk('public')
    expect(disk).toBeDefined()
  })

  test('disk() throws for unconfigured disk name', () => {
    expect(() => storage.disk('nonexistent')).toThrow('not configured')
  })
})

describe('Storage Facade - configuration methods', () => {
  test('getDefaultDisk() returns the current default', () => {
    expect(storage.getDefaultDisk()).toBe('local')
  })

  test('getConfiguredDisks() lists all disk names', () => {
    const disks = storage.getConfiguredDisks()
    expect(disks).toContain('local')
    expect(disks).toContain('public')
  })

  test('setDefaultDisk() changes the default', () => {
    storage.setDefaultDisk('public')
    expect(storage.getDefaultDisk()).toBe('public')
  })

  test('setDefaultDisk() throws for unconfigured disk', () => {
    expect(() => storage.setDefaultDisk('s3')).toThrow('not configured')
  })

  test('configure() adds a new disk at runtime', async () => {
    const customRoot = join(testRoot, 'custom')
    mkdirSync(customRoot, { recursive: true })

    storage.configure('custom', {
      driver: 'local',
      root: customRoot,
      visibility: 'private',
    })

    expect(storage.getConfiguredDisks()).toContain('custom')
    const disk = storage.disk('custom')
    expect(disk).toBeDefined()
  })

  test('reset() clears all cached disks and config', () => {
    storage.reset()
    // After reset, getConfiguredDisks will rebuild from defaults
    // Just check it does not throw
    expect(typeof storage.getDefaultDisk()).toBe('string')
  })

  test('getDiskConfig() returns config for a disk', () => {
    const config = storage.getDiskConfig('local')
    expect(config).toBeDefined()
    expect(config!.driver).toBe('local')
  })

  test('getDiskConfig() returns undefined for unconfigured disk', () => {
    const config = storage.getDiskConfig('nonexistent')
    expect(config).toBeUndefined()
  })
})
