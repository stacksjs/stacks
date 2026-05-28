import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderSeederFile, scaffoldClassSeedersFromModels, stripUseSeederTrait } from '../src/seed-scaffold'

/**
 * Tests for the `./buddy seed:scaffold` codemod (stacksjs/stacks#1919
 * Phase 2). The codemod walks `app/Models/*.ts`, finds every model
 * with a `useSeeder` trait, and writes a class-seeder file for it.
 * These tests use a temp directory pair so each run is isolated.
 */

let scratch: string | null = null

function mkScratch(): string {
  scratch = mkdtempSync(join(tmpdir(), 'stacks-seed-scaffold-'))
  return scratch
}

afterEach(() => {
  if (scratch && existsSync(scratch))
    rmSync(scratch, { recursive: true, force: true })
  scratch = null
})

function writeModel(modelsDir: string, file: string, content: string): void {
  if (!existsSync(modelsDir)) mkdirSync(modelsDir, { recursive: true })
  writeFileSync(join(modelsDir, file), content, 'utf-8')
}

describe('renderSeederFile (pure renderer)', () => {
  test('produces the canonical class-seeder template', () => {
    const out = renderSeederFile('Judge', '../../app/Models/Judge', 50)
    expect(out).toContain(`import { factory, Seeder } from '@stacksjs/database'`)
    expect(out).toContain(`import Judge from '../../app/Models/Judge'`)
    expect(out).toContain(`export default class JudgeSeeder extends Seeder`)
    expect(out).toContain(`await factory.generate(Judge, { count: 50 })`)
  })
})

describe('scaffoldClassSeedersFromModels', () => {
  test('returns empty report when no models exist', async () => {
    const root = mkScratch()
    const result = await scaffoldClassSeedersFromModels({
      modelsDir: join(root, 'missing-models'),
      seedersDir: join(root, 'database/seeders'),
    })
    expect(result.generated).toHaveLength(0)
    expect(result.skipped).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })

  test('generates a seeder file for each useSeeder model', async () => {
    const root = mkScratch()
    const modelsDir = join(root, 'app/Models')
    const seedersDir = join(root, 'database/seeders')

    writeModel(modelsDir, 'Judge.ts', `
      export default {
        name: 'Judge',
        table: 'judges',
        traits: { useSeeder: { count: 5 } },
        attributes: {},
      }
    `)
    writeModel(modelsDir, 'CourtHouse.ts', `
      export default {
        name: 'CourtHouse',
        table: 'court_houses',
        traits: { useSeeder: true },
        attributes: {},
      }
    `)

    const result = await scaffoldClassSeedersFromModels({ modelsDir, seedersDir })

    expect(result.generated).toHaveLength(2)
    expect(result.generated.map(g => g.model).sort()).toEqual(['CourtHouse', 'Judge'])

    const judgeSeeder = readFileSync(join(seedersDir, 'JudgeSeeder.ts'), 'utf-8')
    expect(judgeSeeder).toContain(`class JudgeSeeder extends Seeder`)
    expect(judgeSeeder).toContain(`factory.generate(Judge, { count: 5 })`)

    const courtSeeder = readFileSync(join(seedersDir, 'CourtHouseSeeder.ts'), 'utf-8')
    // `useSeeder: true` (boolean form) → falls back to the default count of 10.
    expect(courtSeeder).toContain(`factory.generate(CourtHouse, { count: 10 })`)
  })

  test('skips models without a useSeeder trait', async () => {
    const root = mkScratch()
    const modelsDir = join(root, 'app/Models')
    const seedersDir = join(root, 'database/seeders')

    writeModel(modelsDir, 'PlainModel.ts', `
      export default { name: 'PlainModel', attributes: {} }
    `)

    const result = await scaffoldClassSeedersFromModels({ modelsDir, seedersDir })
    expect(result.generated).toHaveLength(0)
    expect(result.skipped).toHaveLength(1)
    expect(result.skipped[0]).toMatchObject({ model: 'PlainModel', reason: 'no-useseeder' })
  })

  test('skips existing seeder files by default', async () => {
    const root = mkScratch()
    const modelsDir = join(root, 'app/Models')
    const seedersDir = join(root, 'database/seeders')

    writeModel(modelsDir, 'Judge.ts', `
      export default { name: 'Judge', traits: { useSeeder: { count: 3 } }, attributes: {} }
    `)
    mkdirSync(seedersDir, { recursive: true })
    writeFileSync(join(seedersDir, 'JudgeSeeder.ts'), '// existing, hand-written\n', 'utf-8')

    const result = await scaffoldClassSeedersFromModels({ modelsDir, seedersDir })
    expect(result.generated).toHaveLength(0)
    expect(result.skipped[0]).toMatchObject({ model: 'Judge', reason: 'already-exists' })

    // File must NOT have been touched.
    const after = readFileSync(join(seedersDir, 'JudgeSeeder.ts'), 'utf-8')
    expect(after).toBe('// existing, hand-written\n')
  })

  test('--force overwrites existing seeder files', async () => {
    const root = mkScratch()
    const modelsDir = join(root, 'app/Models')
    const seedersDir = join(root, 'database/seeders')

    writeModel(modelsDir, 'Judge.ts', `
      export default { name: 'Judge', traits: { useSeeder: { count: 99 } }, attributes: {} }
    `)
    mkdirSync(seedersDir, { recursive: true })
    writeFileSync(join(seedersDir, 'JudgeSeeder.ts'), '// existing, hand-written\n', 'utf-8')

    const result = await scaffoldClassSeedersFromModels({ modelsDir, seedersDir, force: true })
    expect(result.generated).toHaveLength(1)

    const after = readFileSync(join(seedersDir, 'JudgeSeeder.ts'), 'utf-8')
    expect(after).not.toBe('// existing, hand-written\n')
    expect(after).toContain('factory.generate(Judge, { count: 99 })')
  })

  test('--dry-run reports planned writes but writes nothing', async () => {
    const root = mkScratch()
    const modelsDir = join(root, 'app/Models')
    const seedersDir = join(root, 'database/seeders')

    writeModel(modelsDir, 'Judge.ts', `
      export default { name: 'Judge', traits: { useSeeder: { count: 5 } }, attributes: {} }
    `)

    const result = await scaffoldClassSeedersFromModels({ modelsDir, seedersDir, dryRun: true })
    expect(result.generated).toHaveLength(1)
    expect(existsSync(join(seedersDir, 'JudgeSeeder.ts'))).toBe(false)
  })

  test('uses relative path from seedersDir → modelsDir for the import', async () => {
    const root = mkScratch()
    const modelsDir = join(root, 'app/Models')
    const seedersDir = join(root, 'database/seeders')

    writeModel(modelsDir, 'Judge.ts', `
      export default { name: 'Judge', traits: { useSeeder: { count: 1 } }, attributes: {} }
    `)

    await scaffoldClassSeedersFromModels({ modelsDir, seedersDir })
    const content = readFileSync(join(seedersDir, 'JudgeSeeder.ts'), 'utf-8')
    // Conventional layout: seedersDir at `<root>/database/seeders/` →
    // modelsDir at `<root>/app/Models/` → relative import is
    // `../../app/Models/Judge`.
    expect(content).toContain(`import Judge from '../../app/Models/Judge'`)
  })

  test('records errors for malformed model files without aborting the run', async () => {
    const root = mkScratch()
    const modelsDir = join(root, 'app/Models')
    const seedersDir = join(root, 'database/seeders')

    writeModel(modelsDir, 'Broken.ts', `this is not valid typescript {{{`)
    writeModel(modelsDir, 'Judge.ts', `
      export default { name: 'Judge', traits: { useSeeder: { count: 1 } }, attributes: {} }
    `)

    const result = await scaffoldClassSeedersFromModels({ modelsDir, seedersDir })
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]?.model).toBe('Broken.ts')
    // The well-formed model is still scaffolded — the bad file doesn't
    // poison the rest of the run.
    expect(result.generated).toHaveLength(1)
    expect(result.generated[0]?.model).toBe('Judge')
  })
})

describe('stripUseSeederTrait — pure (stacksjs/stacks#1929)', () => {
  test('removes a multi-line object trait, keeping siblings', () => {
    const src = [
      `export default {`,
      `  name: 'Judge',`,
      `  traits: {`,
      `    useTimestamps: true,`,
      `    useSeeder: { count: 10 },`,
      `    useSearch: true,`,
      `  },`,
      `}`,
      ``,
    ].join('\n')
    const { source, changed } = stripUseSeederTrait(src)
    expect(changed).toBe(true)
    expect(source).not.toContain('useSeeder')
    expect(source).toContain('useTimestamps: true')
    expect(source).toContain('useSearch: true')
    // The surviving lines stay intact (no dangling fragments).
    expect(source).toContain(`    useTimestamps: true,\n    useSearch: true,`)
  })

  test('removes the boolean form', () => {
    const src = `export default { name: 'X', traits: { useSeeder: true, useUuid: true } }`
    const { source, changed } = stripUseSeederTrait(src)
    expect(changed).toBe(true)
    expect(source).not.toContain('useSeeder')
    expect(source).toContain('useUuid: true')
  })

  test('removes the `seedable` alias too', () => {
    const src = `export default { name: 'X', traits: { seedable: { count: 3 } } }`
    const { source, changed } = stripUseSeederTrait(src)
    expect(changed).toBe(true)
    expect(source).not.toContain('seedable')
  })

  test('strips a trailing line comment along with the trait', () => {
    const src = [
      `  traits: {`,
      `    useSeeder: { count: 10 }, // seed ten`,
      `    taggable: true,`,
      `  },`,
    ].join('\n')
    const { source, changed } = stripUseSeederTrait(src)
    expect(changed).toBe(true)
    expect(source).not.toContain('useSeeder')
    expect(source).not.toContain('seed ten')
    expect(source).toContain('taggable: true')
  })

  test('handles a nested object value (fixtures array of objects)', () => {
    const src = [
      `  traits: {`,
      `    useSeeder: { count: 2, fixtures: [{ name: 'a' }, { name: 'b' }] },`,
      `    useUuid: true,`,
      `  },`,
    ].join('\n')
    const { source, changed } = stripUseSeederTrait(src)
    expect(changed).toBe(true)
    expect(source).not.toContain('useSeeder')
    expect(source).not.toContain('fixtures')
    expect(source).toContain('useUuid: true')
  })

  test('leaves unusual value shapes alone and flags skipped', () => {
    // A trait whose value is an identifier (not true/false/{...}) —
    // don't risk a mangled edit; signal manual cleanup.
    const src = `export default { name: 'X', traits: { useSeeder: seedConfig } }`
    const { source, changed, skipped } = stripUseSeederTrait(src)
    expect(changed).toBe(false)
    expect(skipped).toBe(true)
    expect(source).toBe(src)
  })

  test('no-op when there is no useSeeder trait', () => {
    const src = `export default { name: 'X', traits: { useUuid: true } }`
    const { changed, skipped } = stripUseSeederTrait(src)
    expect(changed).toBe(false)
    expect(skipped).toBe(false)
  })
})

describe('scaffoldClassSeedersFromModels — strips trait after writing (stacksjs/stacks#1929)', () => {
  test('removes the useSeeder block from the model file', async () => {
    const root = mkScratch()
    const modelsDir = join(root, 'app/Models')
    const seedersDir = join(root, 'database/seeders')

    writeModel(modelsDir, 'Judge.ts', [
      `export default {`,
      `  name: 'Judge',`,
      `  table: 'judges',`,
      `  traits: {`,
      `    useTimestamps: true,`,
      `    useSeeder: { count: 5 },`,
      `  },`,
      `  attributes: {},`,
      `}`,
      ``,
    ].join('\n'))

    const result = await scaffoldClassSeedersFromModels({ modelsDir, seedersDir })

    expect(result.generated).toHaveLength(1)
    expect(result.strippedTrait.map(s => s.model)).toEqual(['Judge'])

    const modelAfter = readFileSync(join(modelsDir, 'Judge.ts'), 'utf-8')
    expect(modelAfter).not.toContain('useSeeder')
    expect(modelAfter).toContain('useTimestamps: true')
    // Seeder still written with the right count.
    const seeder = readFileSync(join(seedersDir, 'JudgeSeeder.ts'), 'utf-8')
    expect(seeder).toContain('factory.generate(Judge, { count: 5 })')
  })

  test('--dry-run reports the strip but does not modify the model file', async () => {
    const root = mkScratch()
    const modelsDir = join(root, 'app/Models')
    const seedersDir = join(root, 'database/seeders')

    const original = [
      `export default { name: 'Judge', table: 'judges', traits: { useSeeder: { count: 5 } }, attributes: {} }`,
      ``,
    ].join('\n')
    writeModel(modelsDir, 'Judge.ts', original)

    const result = await scaffoldClassSeedersFromModels({ modelsDir, seedersDir, dryRun: true })
    expect(result.strippedTrait.map(s => s.model)).toEqual(['Judge'])

    // File untouched in dry-run.
    expect(readFileSync(join(modelsDir, 'Judge.ts'), 'utf-8')).toBe(original)
    expect(existsSync(join(seedersDir, 'JudgeSeeder.ts'))).toBe(false)
  })

  test('strips the trait even when the seeder already exists', async () => {
    const root = mkScratch()
    const modelsDir = join(root, 'app/Models')
    const seedersDir = join(root, 'database/seeders')

    writeModel(modelsDir, 'Judge.ts', `export default { name: 'Judge', table: 'judges', traits: { useSeeder: true }, attributes: {} }\n`)
    mkdirSync(seedersDir, { recursive: true })
    writeFileSync(join(seedersDir, 'JudgeSeeder.ts'), '// hand-written, keep me\n', 'utf-8')

    const result = await scaffoldClassSeedersFromModels({ modelsDir, seedersDir })

    // Seeder left untouched (already-exists), but the redundant trait is gone.
    expect(result.skipped.some(s => s.reason === 'already-exists')).toBe(true)
    expect(result.strippedTrait.map(s => s.model)).toEqual(['Judge'])
    expect(readFileSync(join(seedersDir, 'JudgeSeeder.ts'), 'utf-8')).toBe('// hand-written, keep me\n')
    expect(readFileSync(join(modelsDir, 'Judge.ts'), 'utf-8')).not.toContain('useSeeder')
  })
})
