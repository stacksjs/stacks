import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Database Seeder Tests
 *
 * IMPORTANT: We do NOT call seed() or freshSeed() in tests because they
 * modify the database (insert/drop rows). Instead we test that the
 * functions exist, have the correct interface, and we test the
 * non-destructive discovery functions.
 */

const { seed, freshSeed, seedModel$, listSeedableModels, PROTECTED_MODELS, isProtectedModel, runApplicationSeeders, Seeder } = await import('../src/seeder')

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

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

  test('Seeder is an abstract-compatible base class', () => {
    class TestSeeder extends Seeder {
      run(): void {}
    }

    expect(new TestSeeder()).toBeInstanceOf(Seeder)
  })
})

describe('Database Seeder - application seeders', () => {
  test('runs nested application seeders in deterministic path order', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'stacks-application-seeders-'))
    temporaryDirectories.push(directory)
    mkdirSync(join(directory, 'nested'))
    const output = join(directory, 'order.txt')
    const seederModule = new URL('../src/seeder.ts', import.meta.url).href

    writeFileSync(join(directory, '20-second.ts'), `
      import { appendFileSync } from 'node:fs'
      import { Seeder } from '${seederModule}'
      export default class SecondSeeder extends Seeder {
        run() { appendFileSync(${JSON.stringify(output)}, 'second\\n') }
      }
    `)
    writeFileSync(join(directory, '10-first.ts'), `
      import { appendFileSync } from 'node:fs'
      import { Seeder } from '${seederModule}'
      export default class FirstSeeder extends Seeder {
        run() { appendFileSync(${JSON.stringify(output)}, 'first\\n') }
      }
    `)
    writeFileSync(join(directory, 'nested/30-third.ts'), `
      import { appendFileSync } from 'node:fs'
      import { Seeder } from '${seederModule}'
      export default class ThirdSeeder extends Seeder {
        run() { appendFileSync(${JSON.stringify(output)}, 'third\\n') }
      }
    `)

    const result = await runApplicationSeeders({ directory, verbose: false })

    expect(result.total).toBe(3)
    expect(result.successful).toBe(3)
    expect(result.failed).toBe(0)
    expect(await Bun.file(output).text()).toBe('first\nsecond\nthird\n')
    expect(result.results.map(item => item.seeder)).toEqual(['FirstSeeder', 'SecondSeeder', 'ThirdSeeder'])
  })

  test('reports invalid modules and continues running later seeders', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'stacks-invalid-seeders-'))
    temporaryDirectories.push(directory)
    const output = join(directory, 'continued.txt')
    const seederModule = new URL('../src/seeder.ts', import.meta.url).href

    writeFileSync(join(directory, '10-invalid.ts'), 'export default { run() {} }')
    writeFileSync(join(directory, '20-valid.ts'), `
      import { writeFileSync } from 'node:fs'
      import { Seeder } from '${seederModule}'
      export default class ValidSeeder extends Seeder {
        run() { writeFileSync(${JSON.stringify(output)}, 'yes') }
      }
    `)

    const result = await runApplicationSeeders({ directory, verbose: false })

    expect(result.total).toBe(2)
    expect(result.successful).toBe(1)
    expect(result.failed).toBe(1)
    expect(result.results[0]?.error).toContain('default export must be a Seeder class')
    expect(await Bun.file(output).text()).toBe('yes')
  })

  test('returns an empty summary when the application directory is absent', async () => {
    const directory = join(tmpdir(), `stacks-missing-seeders-${crypto.randomUUID()}`)
    const result = await runApplicationSeeders({ directory, verbose: false })

    expect(result).toMatchObject({ total: 0, successful: 0, failed: 0, results: [] })
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
