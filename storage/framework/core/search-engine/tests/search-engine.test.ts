import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Resolve paths relative to the test file so the suite works
// whether `bun test` is invoked from the package directory or the
// repo root. The hardcoded repo-relative form (`storage/framework/
// core/search-engine/src/...`) only resolved correctly from the
// repo root and broke any package-local run.
const PKG_SRC = join(import.meta.dir, '..', 'src')

describe('@stacksjs/search-engine', () => {
  test('SearchDriver type has expected values', () => {
    // The search engine exports these driver types
    const validDrivers = ['meilisearch', 'algolia', 'opensearch']
    expect(validDrivers).toContain('meilisearch')
    expect(validDrivers).toContain('algolia')
    expect(validDrivers).toContain('opensearch')
  })

  test('helpers module loads', async () => {
    const helpers = await import('../src/helpers')
    expect(helpers).toBeDefined()
  })

  test('types module loads', async () => {
    const types = await import('../src/types')
    expect(types).toBeDefined()
  })

  test('index file exists and parses', () => {
    const content = readFileSync(join(PKG_SRC, 'index.ts'), 'utf-8')
    expect(content).toContain('useSearchEngine')
    expect(content).toContain('useMeilisearch')
    expect(content).toContain('useAlgolia')
    expect(content).toContain('useOpensearch')
  })

  test('driver files exist', () => {
    expect(existsSync(join(PKG_SRC, 'drivers', 'meilisearch.ts'))).toBe(true)
    expect(existsSync(join(PKG_SRC, 'drivers', 'algolia.ts'))).toBe(true)
    expect(existsSync(join(PKG_SRC, 'drivers', 'opensearch.ts'))).toBe(true)
  })

  test('documents module has expected exports', () => {
    const content = readFileSync(join(PKG_SRC, 'documents', 'index.ts'), 'utf-8')
    expect(content).toContain('./add')
    expect(content).toContain('./flush')
    expect(content).toContain('./settings')
  })
})

/**
 * The entry used to bind its driver with two top-level `await`s. That cost two
 * things: a top-level await in a published entrypoint breaks a consumer's binary
 * build, and it is a statement where a `.d.ts` may hold only declarations - so
 * this package shipped a declaration file TypeScript rejected outright (TS1036),
 * taking every type in it down with it.
 *
 * The driver now resolves in the background and `useSearchEngine()` hands back a
 * proxy, so the composable stays synchronous and destructurable exactly as
 * before. These cover both sides of that proxy, since the whole point is that
 * callers could not tell the difference.
 */
describe('search engine driver binding', () => {
  test('the entry has no top-level await', () => {
    const content = readFileSync(join(PKG_SRC, 'index.ts'), 'utf-8')
    const topLevel = content.split('\n').filter(l => /^(await |const .* = await )/.test(l))
    expect(topLevel).toEqual([])
  })

  test('destructuring still works before the driver has resolved', async () => {
    const { useSearchEngine } = await import('../src/index')
    const { addDocument, updateSettings } = useSearchEngine()
    expect(typeof addDocument).toBe('function')
    expect(typeof updateSettings).toBe('function')
  })

  test('hands back the driver\'s own members once it has resolved', async () => {
    const { useSearchEngine, searchEngineReady } = await import('../src/index')
    const driver = await searchEngineReady()
    const engine = useSearchEngine()

    // identity, not just callability: after resolution the proxy stops wrapping
    expect(engine.addDocument).toBe(driver.addDocument)
    expect(engine.client).toBe(driver.client)
  })

  test('keeps the synchronous members synchronous', async () => {
    const { useSearchEngine, searchEngineReady } = await import('../src/index')
    await searchEngineReady()
    // `client()` returns a client, not a promise for one - the reason the proxy
    // forwards directly instead of deferring everything forever
    expect(useSearchEngine().client()).not.toBeInstanceOf(Promise)
  })
})
