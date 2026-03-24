import { describe, expect, it } from 'bun:test'
import {
  actionsPath,
  appPath,
  arraysPath,
  basename,
  buildPath,
  cachePath,
  configPath,
  corePath,
  dirname,
  extname,
  frameworkPath,
  join,
  libsPath,
  projectPath,
  resolve,
  resourcesPath,
  storagePath,
  userActionsPath,
  userModelsPath,
} from '../src/index'

describe('projectPath', () => {
  it('should return the project root path', () => {
    const result = projectPath()
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('should join a subpath', () => {
    const result = projectPath('package.json')
    expect(result).toContain('package.json')
  })

  it('should not end with separator when no argument', () => {
    const result = projectPath()
    expect(result.endsWith('/')).toBe(false)
  })
})

describe('storagePath', () => {
  it('should contain storage segment', () => {
    const result = storagePath()
    expect(result).toContain('storage')
  })

  it('should join a subpath', () => {
    const result = storagePath('logs')
    expect(result).toContain('storage/logs')
  })
})

describe('frameworkPath', () => {
  it('should contain storage/framework segment', () => {
    const result = frameworkPath()
    expect(result).toContain('storage/framework')
  })

  it('should join a subpath', () => {
    const result = frameworkPath('core')
    expect(result).toContain('storage/framework/core')
  })
})

describe('corePath', () => {
  it('should contain storage/framework/core segment', () => {
    const result = corePath()
    expect(result).toContain('storage/framework/core')
  })

  it('should join a subpath', () => {
    const result = corePath('strings')
    expect(result).toContain('storage/framework/core/strings')
  })
})

describe('appPath', () => {
  it('should contain app segment', () => {
    const result = appPath()
    expect(result).toContain('app')
  })

  it('should join a subpath', () => {
    const result = appPath('Models/User.ts')
    expect(result).toContain('app/Models/User.ts')
  })
})

describe('configPath', () => {
  it('should contain config segment', () => {
    const result = configPath()
    expect(result).toContain('core/config')
  })

  it('should join a subpath', () => {
    const result = configPath('app.ts')
    expect(result).toContain('core/config/app.ts')
  })
})

describe('resourcesPath', () => {
  it('should contain resources segment', () => {
    const result = resourcesPath()
    expect(result).toContain('resources')
  })

  it('should join a subpath', () => {
    const result = resourcesPath('views')
    expect(result).toContain('resources/views')
  })
})

describe('userActionsPath', () => {
  it('should contain app/Actions segment', () => {
    const result = userActionsPath()
    expect(result).toContain('app/Actions')
  })

  it('should join a subpath', () => {
    const result = userActionsPath('MyAction.ts')
    expect(result).toContain('app/Actions/MyAction.ts')
  })
})

describe('userModelsPath', () => {
  it('should contain app/Models segment', () => {
    const result = userModelsPath()
    expect(result).toContain('app/Models')
  })

  it('should join a subpath', () => {
    const result = userModelsPath('User.ts')
    expect(result).toContain('app/Models/User.ts')
  })
})

describe('actionsPath', () => {
  it('should contain core/actions segment', () => {
    const result = actionsPath()
    expect(result).toContain('core/actions')
  })

  it('should join a subpath', () => {
    const result = actionsPath('index.ts')
    expect(result).toContain('core/actions/index.ts')
  })
})

describe('buildPath', () => {
  it('should contain core/build segment', () => {
    const result = buildPath()
    expect(result).toContain('core/build')
  })
})

describe('cachePath', () => {
  it('should contain core/cache segment', () => {
    const result = cachePath()
    expect(result).toContain('core/cache')
  })
})

describe('arraysPath', () => {
  it('should contain core/arrays segment', () => {
    const result = arraysPath()
    expect(result).toContain('core/arrays')
  })
})

describe('libsPath', () => {
  it('should contain framework/libs segment', () => {
    const result = libsPath()
    expect(result).toContain('framework/libs')
  })
})

describe('all path functions return strings', () => {
  it('projectPath returns a string', () => {
    expect(typeof projectPath()).toBe('string')
  })

  it('storagePath returns a string', () => {
    expect(typeof storagePath()).toBe('string')
  })

  it('frameworkPath returns a string', () => {
    expect(typeof frameworkPath()).toBe('string')
  })

  it('corePath returns a string', () => {
    expect(typeof corePath()).toBe('string')
  })

  it('appPath returns a string', () => {
    expect(typeof appPath()).toBe('string')
  })
})

describe('re-exported node:path functions', () => {
  it('join should join path segments', () => {
    expect(join('/foo', 'bar', 'baz')).toBe('/foo/bar/baz')
  })

  it('resolve should resolve to absolute path', () => {
    const result = resolve('foo', 'bar')
    expect(result.startsWith('/')).toBe(true)
  })

  it('basename should return the file name', () => {
    expect(basename('/foo/bar/baz.txt')).toBe('baz.txt')
  })

  it('basename should strip extension when provided', () => {
    expect(basename('/foo/bar/baz.txt', '.txt')).toBe('baz')
  })

  it('dirname should return the directory name', () => {
    expect(dirname('/foo/bar/baz.txt')).toBe('/foo/bar')
  })

  it('extname should return the extension', () => {
    expect(extname('/foo/bar/baz.txt')).toBe('.txt')
  })

  it('extname should return empty string for no extension', () => {
    expect(extname('/foo/bar/baz')).toBe('')
  })
})
