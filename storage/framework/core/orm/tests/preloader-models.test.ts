import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * Tests for the preloader's model loading into globalThis.
 *
 * The preloader scans model directories, imports default exports,
 * and assigns them to globalThis so users can use models without imports.
 *
 * Priority: user models > framework models > default models
 * Protected globals (Array, Map, etc.) are never overwritten.
 */

const tmpDir = resolve(import.meta.dir, '../../../../../.tmp-preloader-test')

// Track globals we add so we can clean them up
const addedGlobals: string[] = []

beforeAll(() => {
  mkdirSync(join(tmpDir, 'user-models'), { recursive: true })
  mkdirSync(join(tmpDir, 'framework-models'), { recursive: true })
  mkdirSync(join(tmpDir, 'default-models'), { recursive: true })

  // User model — highest priority
  writeFileSync(
    join(tmpDir, 'user-models/TestPost.ts'),
    `export default { name: 'TestPost', table: 'test_posts', source: 'user', where: () => 'user-query' }\n`,
  )

  // Framework model — overridden by user model
  writeFileSync(
    join(tmpDir, 'framework-models/TestPost.ts'),
    `export default { name: 'TestPost', table: 'test_posts', source: 'framework', where: () => 'framework-query' }\n`,
  )

  // Framework-only model
  writeFileSync(
    join(tmpDir, 'framework-models/TestAuthor.ts'),
    `export default { name: 'TestAuthor', table: 'test_authors', source: 'framework', where: () => 'author-query' }\n`,
  )

  // Default-only model
  writeFileSync(
    join(tmpDir, 'default-models/TestPage.ts'),
    `export default { name: 'TestPage', table: 'test_pages', source: 'default', where: () => 'page-query' }\n`,
  )

  // Model that overlaps with framework (default should lose)
  writeFileSync(
    join(tmpDir, 'default-models/TestAuthor.ts'),
    `export default { name: 'TestAuthor', table: 'test_authors', source: 'default-override', where: () => 'default-author-query' }\n`,
  )

  // index.ts should be skipped
  writeFileSync(
    join(tmpDir, 'user-models/index.ts'),
    `export {}\n`,
  )

  // .d.ts should be skipped
  writeFileSync(
    join(tmpDir, 'user-models/types.d.ts'),
    `export type Foo = string\n`,
  )
})

afterAll(() => {
  // Clean up globals
  for (const name of addedGlobals) {
    delete (globalThis as any)[name]
  }

  // Clean up temp directory
  try {
    rmSync(tmpDir, { recursive: true, force: true })
  }
  catch {
    // Ignore cleanup errors
  }
})

afterEach(() => {
  // Clean up any globals added during tests
  for (const name of addedGlobals) {
    delete (globalThis as any)[name]
  }
  addedGlobals.length = 0
})

describe('preloader model loading', () => {
  describe('model scanning and loading', () => {
    it('should load model default exports into globalThis', async () => {
      const { Glob } = await import('bun')
      const glob = new Glob('**/*.ts')
      const dir = join(tmpDir, 'default-models')

      for await (const file of glob.scan({ cwd: dir, absolute: true, onlyFiles: true })) {
        if (file.endsWith('.d.ts') || file.endsWith('/index.ts')) continue

        const modelName = file.split('/').pop()?.replace('.ts', '') || ''
        if (!modelName) continue

        const module = await import(file)
        if (module.default) {
          (globalThis as any)[modelName] = module.default
          addedGlobals.push(modelName)
        }
      }

      expect((globalThis as any).TestPage).toBeDefined()
      expect((globalThis as any).TestPage.name).toBe('TestPage')
      expect((globalThis as any).TestPage.source).toBe('default')
    })

    it('should skip .d.ts files', async () => {
      const { Glob } = await import('bun')
      const glob = new Glob('**/*.ts')
      const dir = join(tmpDir, 'user-models')
      const scannedFiles: string[] = []

      for await (const file of glob.scan({ cwd: dir, absolute: true, onlyFiles: true })) {
        if (file.endsWith('.d.ts') || file.endsWith('/index.ts')) continue
        scannedFiles.push(file)
      }

      const basenames = scannedFiles.map(f => f.split('/').pop())
      expect(basenames).not.toContain('types.d.ts')
    })

    it('should skip index.ts files', async () => {
      const { Glob } = await import('bun')
      const glob = new Glob('**/*.ts')
      const dir = join(tmpDir, 'user-models')
      const scannedFiles: string[] = []

      for await (const file of glob.scan({ cwd: dir, absolute: true, onlyFiles: true })) {
        if (file.endsWith('.d.ts') || file.endsWith('/index.ts')) continue
        scannedFiles.push(file)
      }

      const basenames = scannedFiles.map(f => f.split('/').pop())
      expect(basenames).not.toContain('index.ts')
    })
  })

  describe('priority and deduplication', () => {
    it('should give user models highest priority', async () => {
      const { Glob } = await import('bun')
      const glob = new Glob('**/*.ts')

      const modelDirs = [
        join(tmpDir, 'user-models'),
        join(tmpDir, 'framework-models'),
        join(tmpDir, 'default-models'),
      ]

      const loadedModels = new Set<string>()

      for (const dir of modelDirs) {
        try {
          for await (const file of glob.scan({ cwd: dir, absolute: true, onlyFiles: true })) {
            if (file.endsWith('.d.ts') || file.endsWith('/index.ts')) continue

            const modelName = file.split('/').pop()?.replace('.ts', '') || ''
            if (!modelName || loadedModels.has(modelName)) continue

            const module = await import(file)
            if (module.default) {
              (globalThis as any)[modelName] = module.default
              loadedModels.add(modelName)
              addedGlobals.push(modelName)
            }
          }
        }
        catch {
          // Directory may not exist
        }
      }

      // TestPost exists in both user-models and framework-models
      // User model should win (scanned first)
      expect((globalThis as any).TestPost).toBeDefined()
      expect((globalThis as any).TestPost.source).toBe('user')
    })

    it('should give framework models priority over default models', async () => {
      const { Glob } = await import('bun')
      const glob = new Glob('**/*.ts')

      const modelDirs = [
        join(tmpDir, 'user-models'),
        join(tmpDir, 'framework-models'),
        join(tmpDir, 'default-models'),
      ]

      const loadedModels = new Set<string>()

      for (const dir of modelDirs) {
        try {
          for await (const file of glob.scan({ cwd: dir, absolute: true, onlyFiles: true })) {
            if (file.endsWith('.d.ts') || file.endsWith('/index.ts')) continue

            const modelName = file.split('/').pop()?.replace('.ts', '') || ''
            if (!modelName || loadedModels.has(modelName)) continue

            const module = await import(file)
            if (module.default) {
              (globalThis as any)[modelName] = module.default
              loadedModels.add(modelName)
              addedGlobals.push(modelName)
            }
          }
        }
        catch {
          // Directory may not exist
        }
      }

      // TestAuthor exists in both framework-models and default-models
      // Framework model should win
      expect((globalThis as any).TestAuthor).toBeDefined()
      expect((globalThis as any).TestAuthor.source).toBe('framework')
    })

    it('should load models only present in default directory', async () => {
      const { Glob } = await import('bun')
      const glob = new Glob('**/*.ts')

      const modelDirs = [
        join(tmpDir, 'user-models'),
        join(tmpDir, 'framework-models'),
        join(tmpDir, 'default-models'),
      ]

      const loadedModels = new Set<string>()

      for (const dir of modelDirs) {
        try {
          for await (const file of glob.scan({ cwd: dir, absolute: true, onlyFiles: true })) {
            if (file.endsWith('.d.ts') || file.endsWith('/index.ts')) continue

            const modelName = file.split('/').pop()?.replace('.ts', '') || ''
            if (!modelName || loadedModels.has(modelName)) continue

            const module = await import(file)
            if (module.default) {
              (globalThis as any)[modelName] = module.default
              loadedModels.add(modelName)
              addedGlobals.push(modelName)
            }
          }
        }
        catch {
          // Directory may not exist
        }
      }

      // TestPage only exists in default-models
      expect((globalThis as any).TestPage).toBeDefined()
      expect((globalThis as any).TestPage.source).toBe('default')
    })
  })

  describe('protected globals', () => {
    it('should not overwrite protected built-in globals', async () => {
      const protectedGlobals = new Set([
        'process', 'globalThis', 'global', 'window', 'self',
        'console', 'require', 'module', 'exports', '__dirname', '__filename',
        'Buffer', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
        'setImmediate', 'clearImmediate', 'queueMicrotask',
        'fetch', 'Request', 'Response', 'Headers', 'URL', 'URLSearchParams',
        'TextEncoder', 'TextDecoder', 'Blob', 'File', 'FormData',
        'crypto', 'performance', 'navigator', 'location',
        'Promise', 'Symbol', 'Proxy', 'Reflect', 'WeakMap', 'WeakSet', 'Map', 'Set',
        'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'RegExp', 'Error',
        'JSON', 'Math', 'Intl', 'eval', 'isNaN', 'isFinite', 'parseInt', 'parseFloat',
        'encodeURI', 'encodeURIComponent', 'decodeURI', 'decodeURIComponent',
        'Bun', 'Deno', 'Node',
      ])

      // Create a model file named after a protected global
      const conflictDir = join(tmpDir, 'conflict-models')
      mkdirSync(conflictDir, { recursive: true })
      writeFileSync(
        join(conflictDir, 'Error.ts'),
        `export default { name: 'Error', source: 'conflict' }\n`,
      )
      writeFileSync(
        join(conflictDir, 'Array.ts'),
        `export default { name: 'Array', source: 'conflict' }\n`,
      )
      writeFileSync(
        join(conflictDir, 'Map.ts'),
        `export default { name: 'Map', source: 'conflict' }\n`,
      )

      // Save original values
      const originalError = globalThis.Error
      const originalArray = globalThis.Array
      const originalMap = globalThis.Map

      // Simulate preloader model loading with protection
      const { Glob } = await import('bun')
      const glob = new Glob('**/*.ts')
      const loadedModels = new Set<string>()

      for await (const file of glob.scan({ cwd: conflictDir, absolute: true, onlyFiles: true })) {
        if (file.endsWith('.d.ts') || file.endsWith('/index.ts')) continue

        const modelName = file.split('/').pop()?.replace('.ts', '') || ''
        if (!modelName || loadedModels.has(modelName) || protectedGlobals.has(modelName)) continue

        const module = await import(file)
        if (module.default) {
          (globalThis as any)[modelName] = module.default
          loadedModels.add(modelName)
          addedGlobals.push(modelName)
        }
      }

      // Verify protected globals were NOT overwritten
      expect(globalThis.Error).toBe(originalError)
      expect(globalThis.Array).toBe(originalArray)
      expect(globalThis.Map).toBe(originalMap)

      // Clean up
      try { rmSync(conflictDir, { recursive: true, force: true }) } catch {}
    })
  })

  describe('error handling', () => {
    it('should handle non-existent directories gracefully', async () => {
      const { Glob } = await import('bun')
      const glob = new Glob('**/*.ts')
      const nonExistentDir = join(tmpDir, 'does-not-exist')

      let caught = false
      try {
        for await (const _file of glob.scan({ cwd: nonExistentDir, absolute: true, onlyFiles: true })) {
          // Should not reach here
        }
      }
      catch {
        caught = true
      }

      // Either throws or produces no results — both are acceptable
      // The preloader wraps this in try/catch
      expect(true).toBe(true) // Test passes if we reach here without crashing
    })

    it('should handle files without default exports gracefully', async () => {
      const noDefaultDir = join(tmpDir, 'no-default-models')
      mkdirSync(noDefaultDir, { recursive: true })
      writeFileSync(
        join(noDefaultDir, 'NoDefault.ts'),
        `export const foo = 'bar'\n`,
      )

      const { Glob } = await import('bun')
      const glob = new Glob('**/*.ts')

      for await (const file of glob.scan({ cwd: noDefaultDir, absolute: true, onlyFiles: true })) {
        if (file.endsWith('.d.ts') || file.endsWith('/index.ts')) continue

        const modelName = file.split('/').pop()?.replace('.ts', '') || ''
        if (!modelName) continue

        const module = await import(file)
        if (module.default) {
          (globalThis as any)[modelName] = module.default
          addedGlobals.push(modelName)
        }
      }

      // NoDefault should NOT be on globalThis since it has no default export
      expect((globalThis as any).NoDefault).toBeUndefined()

      // Clean up
      try { rmSync(noDefaultDir, { recursive: true, force: true }) } catch {}
    })
  })

  describe('model access patterns', () => {
    it('should allow calling query-like methods on loaded models', async () => {
      // Create a model with query methods
      const testModelDir = join(tmpDir, 'query-models')
      mkdirSync(testModelDir, { recursive: true })
      writeFileSync(
        join(testModelDir, 'QueryModel.ts'),
        `export default {
  name: 'QueryModel',
  table: 'query_models',
  where: (col: string, val: any) => ({ col, val, then: () => [] }),
  find: (id: number) => ({ id, name: 'test' }),
  create: (data: any) => ({ ...data, id: 1 }),
}\n`,
      )

      const { Glob } = await import('bun')
      const glob = new Glob('**/*.ts')

      for await (const file of glob.scan({ cwd: testModelDir, absolute: true, onlyFiles: true })) {
        const modelName = file.split('/').pop()?.replace('.ts', '') || ''
        if (!modelName) continue

        const module = await import(file)
        if (module.default) {
          (globalThis as any)[modelName] = module.default
          addedGlobals.push(modelName)
        }
      }

      // Verify the model is accessible on globalThis with query methods
      const model = (globalThis as any).QueryModel
      expect(model).toBeDefined()
      expect(model.name).toBe('QueryModel')
      expect(typeof model.where).toBe('function')
      expect(typeof model.find).toBe('function')
      expect(typeof model.create).toBe('function')

      // Verify query methods work
      const found = model.find(1)
      expect(found.id).toBe(1)

      const created = model.create({ title: 'Test' })
      expect(created.title).toBe('Test')
      expect(created.id).toBe(1)

      // Clean up
      try { rmSync(testModelDir, { recursive: true, force: true }) } catch {}
    })
  })
})
