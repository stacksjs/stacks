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
