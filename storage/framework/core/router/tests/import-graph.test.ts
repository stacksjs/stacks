import type { BuildOutput } from 'bun'
import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'

/**
 * One build, shared by every assertion below.
 *
 * Bundling the router barrel twice in a process that has already registered
 * the stx plugin fails the second build outright ("Unexpected reading file
 * .../bun-plugin-stx/dist/index.js"), which only shows up in a whole-suite run
 * where another file has loaded the plugin first. Memoizing is also simply
 * cheaper: this entrypoint pulls in 445 modules.
 */
let cachedRouterBuild: Promise<BuildOutput> | undefined

function routerBuild(): Promise<BuildOutput> {
  cachedRouterBuild ??= Bun.build({
    entrypoints: [join(import.meta.dir, 'fixtures/import-router.ts')],
    target: 'bun',
    metafile: true,
    write: false,
  })
  return cachedRouterBuild
}

describe('router import graph', () => {
  it('keeps optional subsystems out of the success path', async () => {
    const result = await routerBuild()

    expect(result.success).toBe(true)
    const indexEntry = Object.entries(result.metafile?.inputs ?? {})
      .find(([source]) => source === 'src/index.ts')
    const indexDatabaseImports = indexEntry?.[1].imports
      .filter(entry => entry.path.includes('database/src/')) ?? []
    expect(indexDatabaseImports).toEqual([])

    const routerEntry = Object.entries(result.metafile?.inputs ?? {})
      .find(([source]) => source.endsWith('src/stacks-router.ts'))
    expect(routerEntry).toBeDefined()
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

    const eagerCryptoImports = routerEntry?.[1].imports
      .filter(entry => entry.kind !== 'dynamic-import' && entry.original === 'node:crypto') ?? []
    expect(eagerCryptoImports).toEqual([])

    const eagerPathBarrelImports = routerEntry?.[1].imports
      .filter(entry => entry.kind !== 'dynamic-import' && entry.original === '@stacksjs/path') ?? []
    expect(eagerPathBarrelImports).toEqual([])
    const projectPathImports = routerEntry?.[1].imports
      .filter(entry => entry.kind !== 'dynamic-import' && entry.original === '@stacksjs/path/project') ?? []
    expect(projectPathImports).toHaveLength(1)

    const rateLimitEntry = Object.entries(result.metafile?.inputs ?? {})
      .find(([source]) => source.endsWith('router/src/rate-limit.ts'))
    const eagerActionLimiterDependencies = rateLimitEntry?.[1].imports
      .filter(entry => entry.kind !== 'dynamic-import'
        && (entry.path.includes('ts-rate-limiter') || entry.path.endsWith('error-handling/src/http.ts'))) ?? []
    expect(eagerActionLimiterDependencies).toEqual([])
  })

  /**
   * The barrel re-exports the signed-URL helpers, so a static `node:crypto`
   * import anywhere under `src/` initialises the optional native subsystem for
   * every application that imports the router - including the great majority
   * that never verify a signed URL. Asserting over the whole source tree rather
   * than one file is the point: this was reintroduced once already by a helper
   * added beside `stacks-router.ts` (stacksjs/stacks#2450).
   */
  it('keeps native crypto out of every router source file', async () => {
    const result = await routerBuild()

    expect(result.success).toBe(true)
    const eagerCryptoImporters = Object.entries(result.metafile?.inputs ?? {})
      .filter(([source]) => source.startsWith('src/') || source.includes('router/src/'))
      .filter(([, meta]) => meta.imports.some(entry =>
        entry.kind !== 'dynamic-import'
        && (entry.original === 'node:crypto' || entry.original === 'crypto'),
      ))
      .map(([source]) => source)

    expect(eagerCryptoImporters).toEqual([])
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
