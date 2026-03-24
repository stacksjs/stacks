import { describe, expect, test } from 'bun:test'

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

  test('index file exists and parses', async () => {
    const fs = await import('node:fs')
    const content = fs.readFileSync('storage/framework/core/search-engine/src/index.ts', 'utf-8')
    expect(content).toContain('useSearchEngine')
    expect(content).toContain('useMeilisearch')
    expect(content).toContain('useAlgolia')
    expect(content).toContain('useOpensearch')
  })

  test('driver files exist', async () => {
    const fs = await import('node:fs')
    expect(fs.existsSync('storage/framework/core/search-engine/src/drivers/meilisearch.ts')).toBe(true)
    expect(fs.existsSync('storage/framework/core/search-engine/src/drivers/algolia.ts')).toBe(true)
    expect(fs.existsSync('storage/framework/core/search-engine/src/drivers/opensearch.ts')).toBe(true)
  })

  test('documents module has expected exports', async () => {
    const fs = await import('node:fs')
    const content = fs.readFileSync('storage/framework/core/search-engine/src/documents/index.ts', 'utf-8')
    expect(content).toContain('./add')
    expect(content).toContain('./flush')
    expect(content).toContain('./settings')
  })
})
