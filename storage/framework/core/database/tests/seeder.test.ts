import { describe, expect, test } from 'bun:test'

/**
 * Database Seeder Tests
 *
 * IMPORTANT: We do NOT call seed() or freshSeed() in tests because they
 * modify the database (insert/drop rows). Instead we test that the
 * functions exist, have the correct interface, and we test the
 * non-destructive discovery functions.
 */

const { seed, freshSeed, seedModel$, listSeedableModels, PROTECTED_MODELS, isProtectedModel } = await import('../src/seeder')

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

// ─── stacksjs/stacks#1852: protected-model guard ────────────────────

describe('PROTECTED_MODELS', () => {
  test('is a non-empty readonly array', () => {
    expect(Array.isArray(PROTECTED_MODELS)).toBe(true)
    expect(PROTECTED_MODELS.length).toBeGreaterThan(0)
  })

  test('is frozen so callers cannot mutate the source of truth', () => {
    expect(Object.isFrozen(PROTECTED_MODELS)).toBe(true)
  })

  test('lists the auth/oauth models implicated by the original incident', () => {
    // These four touch token issuance/validation — re-rolling any of them
    // on a non-fresh DB invalidates live sessions.
    expect(PROTECTED_MODELS).toContain('OauthClient')
    expect(PROTECTED_MODELS).toContain('OauthAccessToken')
    expect(PROTECTED_MODELS).toContain('OauthRefreshToken')
    expect(PROTECTED_MODELS).toContain('PersonalAccessToken')
  })
})

describe('isProtectedModel', () => {
  test('returns true for every name on the list', () => {
    for (const name of PROTECTED_MODELS)
      expect(isProtectedModel(name)).toBe(true)
  })

  test('returns false for a regular userland model name', () => {
    expect(isProtectedModel('Post')).toBe(false)
    expect(isProtectedModel('User')).toBe(false)
    expect(isProtectedModel('Subscriber')).toBe(false)
  })

  test('is case-sensitive — the list uses PascalCase class names', () => {
    // The seeder reads `modelDef.name` which is the model's class name
    // (PascalCase). Lower-cased table names are a different namespace
    // and should not match.
    expect(isProtectedModel('oauthclient')).toBe(false)
    expect(isProtectedModel('oauth_clients')).toBe(false)
  })
})
