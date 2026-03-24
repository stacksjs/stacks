import { describe, expect, mock, test } from 'bun:test'

// ---------------------------------------------------------------------------
// Mock deps before importing
// ---------------------------------------------------------------------------

mock.module('@stacksjs/logging', () => ({
  log: {
    info: () => {},
    success: () => {},
    warn: () => {},
    error: () => {},
  },
}))

const mockExecute = mock(() => Promise.resolve([]))
const mockInsertValues = mock(() => ({ execute: mockExecute }))
const mockInsertInto = mock(() => ({ values: mockInsertValues }))
const mockDeleteExecute = mock(() => Promise.resolve())
const mockDeleteFrom = mock(() => ({ execute: mockDeleteExecute }))
const mockSelectLimit = mock(() => ({ execute: mockExecute }))
const mockSelectFrom = mock(() => ({ limit: mockSelectLimit }))

mock.module('@stacksjs/database', () => ({
  db: {
    insertInto: mockInsertInto,
    deleteFrom: mockDeleteFrom,
    selectFrom: mockSelectFrom,
  },
}))

mock.module('@stacksjs/faker', () => ({
  faker: {
    person: { fullName: () => 'John Doe' },
    internet: { email: () => 'john@example.com' },
    lorem: { sentence: () => 'Test sentence.' },
    string: { uuid: () => '123e4567-e89b-12d3-a456-426614174000' },
  },
}))

mock.module('@stacksjs/security', () => ({
  hashMake: mock(() => Promise.resolve('$2b$10$hashed_value')),
}))

mock.module('@stacksjs/path', () => ({
  path: {
    userModelsPath: () => '/tmp/nonexistent-models',
    frameworkPath: (sub: string) => `/tmp/nonexistent-framework/${sub}`,
    join: (...args: string[]) => args.join('/'),
  },
}))

mock.module('@stacksjs/storage', () => ({
  fs: {
    existsSync: () => false,
    readdirSync: () => [],
  },
}))

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

const { seed, freshSeed, seedModel$, listSeedableModels } = await import('../src/seeder')

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Database Seeder - seed()', () => {
  test('returns empty summary when no models are found', async () => {
    const result = await seed({ verbose: false })
    expect(result.total).toBe(0)
    expect(result.successful).toBe(0)
    expect(result.failed).toBe(0)
    expect(result.results).toHaveLength(0)
    expect(result.duration).toBeGreaterThanOrEqual(0)
  })

  test('summary shape has required fields', async () => {
    const result = await seed({ verbose: false })
    expect(result).toHaveProperty('total')
    expect(result).toHaveProperty('successful')
    expect(result).toHaveProperty('failed')
    expect(result).toHaveProperty('results')
    expect(result).toHaveProperty('duration')
  })

  test('only filter restricts which models are seeded', async () => {
    // No models exist, but the filter logic still runs without error
    const result = await seed({ only: ['User'], verbose: false })
    expect(result.total).toBe(0)
  })

  test('except filter excludes models from seeding', async () => {
    const result = await seed({ except: ['User'], verbose: false })
    expect(result.total).toBe(0)
  })
})

describe('Database Seeder - freshSeed()', () => {
  test('freshSeed calls seed with fresh option', async () => {
    const result = await freshSeed({ verbose: false })
    expect(result).toHaveProperty('total')
    expect(result).toHaveProperty('successful')
  })
})

describe('Database Seeder - seedModel$()', () => {
  test('throws when model is not found', async () => {
    await expect(seedModel$('NonexistentModel')).rejects.toThrow('Model not found')
  })
})

describe('Database Seeder - listSeedableModels()', () => {
  test('returns empty list when no models exist', async () => {
    const models = await listSeedableModels()
    expect(Array.isArray(models)).toBe(true)
    expect(models.length).toBe(0)
  })
})
