import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import {
  projectPath,
  storagePath,
  frameworkPath,
  appPath,
  resourcesPath,
  join,
  resolve,
  basename,
  dirname,
  extname,
  isAbsolute,
  normalize,
  relative,
} from '../src/index'

// ---------------------------------------------------------------------------
// projectPath
// ---------------------------------------------------------------------------
describe('projectPath', () => {
  test('returns a string', () => {
    const p = projectPath()
    expect(typeof p).toBe('string')
  })

  test('returned path exists on disk', () => {
    const p = projectPath()
    expect(existsSync(p)).toBe(true)
  })

  test('accepts a relative file path', () => {
    const p = projectPath('package.json')
    expect(p.endsWith('package.json')).toBe(true)
  })

  test('returns an absolute path', () => {
    const p = projectPath()
    expect(isAbsolute(p)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// storagePath
// ---------------------------------------------------------------------------
describe('storagePath', () => {
  test('contains "storage" in the path', () => {
    const p = storagePath()
    expect(p).toContain('storage')
  })

  test('returns an absolute path', () => {
    const p = storagePath()
    expect(isAbsolute(p)).toBe(true)
  })

  test('appends sub-path', () => {
    const p = storagePath('logs')
    expect(p.endsWith('storage/logs')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// frameworkPath
// ---------------------------------------------------------------------------
describe('frameworkPath', () => {
  test('contains "framework" in the path', () => {
    const p = frameworkPath()
    expect(p).toContain('framework')
  })

  test('contains "storage" because framework is inside storage', () => {
    const p = frameworkPath()
    expect(p).toContain('storage')
  })

  test('appends sub-path correctly', () => {
    const p = frameworkPath('core')
    expect(p.endsWith('framework/core')).toBe(true)
  })

  test('relative option returns non-absolute path', () => {
    const p = frameworkPath('core', { relative: true })
    expect(isAbsolute(p)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// appPath
// ---------------------------------------------------------------------------
describe('appPath', () => {
  test('contains "app" segment', () => {
    const p = appPath()
    expect(p).toContain('/app')
  })

  test('appends sub-path', () => {
    const p = appPath('Models')
    expect(p.endsWith('app/Models')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// resourcesPath
// ---------------------------------------------------------------------------
describe('resourcesPath', () => {
  test('contains "resources" segment', () => {
    const p = resourcesPath()
    expect(p).toContain('resources')
  })
})

// ---------------------------------------------------------------------------
// Node.js path re-exports: join, resolve, basename, dirname, extname
// ---------------------------------------------------------------------------
describe('join', () => {
  test('combines path segments', () => {
    const result = join('/a', 'b', 'c')
    expect(result).toBe('/a/b/c')
  })

  test('normalizes separators', () => {
    const result = join('/a', 'b/', '/c')
    expect(result).toBe('/a/b/c')
  })
})

describe('resolve', () => {
  test('returns an absolute path', () => {
    const result = resolve('relative/path')
    expect(isAbsolute(result)).toBe(true)
  })
})

describe('basename', () => {
  test('extracts filename from path', () => {
    expect(basename('/foo/bar/baz.txt')).toBe('baz.txt')
  })

  test('strips extension when provided', () => {
    expect(basename('/foo/bar/baz.txt', '.txt')).toBe('baz')
  })
})

describe('dirname', () => {
  test('extracts directory from path', () => {
    expect(dirname('/foo/bar/baz.txt')).toBe('/foo/bar')
  })
})

describe('extname', () => {
  test('extracts extension', () => {
    expect(extname('file.ts')).toBe('.ts')
  })

  test('returns empty string for no extension', () => {
    expect(extname('Makefile')).toBe('')
  })
})

describe('normalize', () => {
  test('resolves . and .. segments', () => {
    const result = normalize('/a/b/../c/./d')
    expect(result).toBe('/a/c/d')
  })
})

describe('relative', () => {
  test('computes relative path between two absolutes', () => {
    const result = relative('/a/b/c', '/a/b/d')
    expect(result).toBe('../d')
  })
})

describe('isAbsolute', () => {
  test('returns true for absolute path', () => {
    expect(isAbsolute('/usr/bin')).toBe(true)
  })

  test('returns false for relative path', () => {
    expect(isAbsolute('relative/path')).toBe(false)
  })
})
