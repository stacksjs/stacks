import { describe, expect, test } from 'bun:test'

/**
 * Database Seeder Tests
 *
 * IMPORTANT: We do NOT call seed() or freshSeed() in tests because they
 * modify the database (insert/drop rows). Instead we test that the
 * functions exist, have the correct interface, and we test the
 * non-destructive discovery functions.
 */

const { seed, freshSeed, seedModel$, listSeedableModels } = await import('../src/seeder')

describe('Database Seeder - exports', () => {
  test('seed is a function', () => {
    expect(typeof seed).toBe('function')
  })

  test('freshSeed is a function', () => {
    expect(typeof freshSeed).toBe('function')
  })

  test('seedModel$ is a function', () => {
    expect(typeof seedModel$).toBe('function')
  })

  test('listSeedableModels is a function', () => {
    expect(typeof listSeedableModels).toBe('function')
  })
})

describe('Database Seeder - listSeedableModels', () => {
  test('returns an array', async () => {
    const models = await listSeedableModels()
    expect(Array.isArray(models)).toBe(true)
  })

  test('discovers framework models', async () => {
    const models = await listSeedableModels()
    expect(models.length).toBeGreaterThan(0)
  })
})

describe('Database Seeder - seedModel$', () => {
  test('throws for nonexistent model', async () => {
    await expect(seedModel$('NonexistentModel12345')).rejects.toThrow()
  })
})
