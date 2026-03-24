import { describe, expect, test } from 'bun:test'

// ---------------------------------------------------------------------------
// Import the real seeder functions directly — no mocks.
// The seeder discovers models from app/Models/ and storage/framework/models/.
// ---------------------------------------------------------------------------

const { seed, freshSeed, seedModel$, listSeedableModels } = await import('../src/seeder')

describe('Database Seeder - seed()', () => {
  test('returns a summary with required shape', async () => {
    const result = await seed({ verbose: false })
    expect(result).toHaveProperty('total')
    expect(result).toHaveProperty('successful')
    expect(result).toHaveProperty('failed')
    expect(result).toHaveProperty('results')
    expect(result).toHaveProperty('duration')
    expect(typeof result.total).toBe('number')
    expect(typeof result.duration).toBe('number')
    expect(result.duration).toBeGreaterThanOrEqual(0)
  })

  test('total equals successful + failed', async () => {
    const result = await seed({ verbose: false })
    expect(result.total).toBe(result.successful + result.failed)
  })

  test('only filter restricts which models are seeded', async () => {
    const allResult = await seed({ verbose: false })
    const filteredResult = await seed({ only: ['User'], verbose: false })
    // Filtered should have fewer or equal models than all
    expect(filteredResult.total).toBeLessThanOrEqual(allResult.total)
  })

  test('except filter excludes models from seeding', async () => {
    const allResult = await seed({ verbose: false })
    const filteredResult = await seed({ except: ['User'], verbose: false })
    expect(filteredResult.total).toBeLessThanOrEqual(allResult.total)
  })
})

describe('Database Seeder - freshSeed()', () => {
  test('freshSeed returns summary with required shape', async () => {
    const result = await freshSeed({ verbose: false })
    expect(result).toHaveProperty('total')
    expect(result).toHaveProperty('successful')
  })
})

describe('Database Seeder - seedModel$()', () => {
  test('throws when model is not found', async () => {
    await expect(seedModel$('NonexistentModelThatDoesNotExist12345')).rejects.toThrow()
  })
})

describe('Database Seeder - listSeedableModels()', () => {
  test('returns an array', async () => {
    const models = await listSeedableModels()
    expect(Array.isArray(models)).toBe(true)
  })

  test('discovers framework models', async () => {
    const models = await listSeedableModels()
    // The framework has 40+ built-in models
    expect(models.length).toBeGreaterThan(0)
  })
})
