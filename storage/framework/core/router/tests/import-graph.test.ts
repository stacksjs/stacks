import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'

describe('router import graph', () => {
  it('keeps optional subsystems out of the success path', async () => {
    const result = await Bun.build({
      entrypoints: [join(import.meta.dir, 'fixtures/import-router.ts')],
      target: 'bun',
      metafile: true,
      write: false,
    })

    expect(result.success).toBe(true)
    const indexEntry = Object.entries(result.metafile?.inputs ?? {})
      .find(([source]) => source === 'src/index.ts')
    const indexDatabaseImports = indexEntry?.[1].imports
      .filter(entry => entry.path.includes('database/src/')) ?? []
    expect(indexDatabaseImports).toEqual([])

    const routerEntry = Object.entries(result.metafile?.inputs ?? {})
      .find(([source]) => source === 'src/stacks-router.ts')
    const eagerStorageBarrelImports = routerEntry?.[1].imports
      .filter(entry => entry.path.endsWith('storage/src/index.ts') && entry.kind !== 'dynamic-import') ?? []
    expect(eagerStorageBarrelImports).toEqual([])
    const uploadedFileInputs = Object.keys(result.metafile?.inputs ?? {})
      .filter(source => source.endsWith('storage/src/uploaded-file.ts'))
    expect(uploadedFileInputs).toHaveLength(1)
    const builtDeepEntrypoints = Object.keys(result.metafile?.inputs ?? {})
      .filter(source => source.includes('/dist/') && (source.includes('/storage/') || source.includes('/error-handling/')))
    expect(builtDeepEntrypoints).toEqual([])

    const eagerErrorHandlingBarrelImports = Object.entries(result.metafile?.inputs ?? {}).flatMap(([source, meta]) =>
      meta.imports
        .filter(entry => ['src/error-handler.ts', 'src/rate-limit.ts', '../logging/src/index.ts'].includes(source)
          && entry.path.endsWith('error-handling/src/index.ts')
          && entry.kind !== 'dynamic-import')
        .map(entry => `${source} -> ${entry.path}`),
    )
    expect(eagerErrorHandlingBarrelImports).toEqual([])

    const loggingEntry = Object.entries(result.metafile?.inputs ?? {})
      .find(([source]) => source.endsWith('logging/src/index.ts'))
    const eagerLoggerDependencies = loggingEntry?.[1].imports
      .filter(entry => entry.kind !== 'dynamic-import'
        && ['@stacksjs/clarity', '@stacksjs/error-handling/handler', '@stacksjs/types'].includes(entry.original ?? '')) ?? []
    expect(eagerLoggerDependencies).toEqual([])

    const eagerRateLimiterImports = routerEntry?.[1].imports
      .filter(entry => entry.kind !== 'dynamic-import' && entry.path.endsWith('router/src/rate-limit.ts')) ?? []
    expect(eagerRateLimiterImports).toEqual([])

    const rateLimitEntry = Object.entries(result.metafile?.inputs ?? {})
      .find(([source]) => source.endsWith('router/src/rate-limit.ts'))
    const eagerActionLimiterDependencies = rateLimitEntry?.[1].imports
      .filter(entry => entry.kind !== 'dynamic-import'
        && (entry.path.includes('ts-rate-limiter') || entry.path.endsWith('error-handling/src/http.ts'))) ?? []
    expect(eagerActionLimiterDependencies).toEqual([])
  })

  it('defers session encryption until an encrypted store is used', async () => {
    const result = await Bun.build({
      entrypoints: [join(import.meta.dir, '../src/encrypted-session-store.ts')],
      target: 'bun',
      metafile: true,
      write: false,
    })

    expect(result.success).toBe(true)
    const entry = Object.entries(result.metafile?.inputs ?? {})
      .find(([source]) => source.endsWith('/encrypted-session-store.ts'))
    const eagerEncryptionDependencies = entry?.[1].imports
      .filter(dependency => dependency.kind !== 'dynamic-import'
        && dependency.original === '@stacksjs/security') ?? []
    expect(eagerEncryptionDependencies).toEqual([])
  })
})
