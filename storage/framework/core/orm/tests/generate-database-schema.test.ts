import type { Model } from '@stacksjs/types'
import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildDatabaseSchema, renderDatabaseTypeFile } from '../src/generate-database-schema'

/**
 * Tests for `buddy generate:db-types` (stacksjs/stacks#1923). Pins
 * the produced `.d.ts` shape + column-type derivation so the
 * `DatabaseSchema` interface augmentation stays stable across refactors.
 */

let scratch: string | null = null

function mkScratch(): string {
  scratch = mkdtempSync(join(tmpdir(), 'stacks-db-types-'))
  return scratch
}

afterEach(() => {
  if (scratch && existsSync(scratch))
    rmSync(scratch, { recursive: true, force: true })
  scratch = null
})

function writeModel(dir: string, name: string, content: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, name), content, 'utf-8')
}

describe('renderDatabaseTypeFile — pure renderer', () => {
  test('emits the canonical module-augmentation shape', () => {
    const out = renderDatabaseTypeFile([
      { table: 'judges', columns: { id: 'number', name: 'string' } },
    ])
    expect(out).toContain(`declare module '@stacksjs/database'`)
    expect(out).toContain(`interface DatabaseSchema`)
    expect(out).toContain(`judges: {`)
    expect(out).toContain(`id: number`)
    expect(out).toContain(`name: string`)
    expect(out).toContain(`export {}`)
  })

  test('alphabetizes tables for stable diffs', () => {
    const out = renderDatabaseTypeFile([
      { table: 'zebras', columns: { id: 'number' } },
      { table: 'apples', columns: { id: 'number' } },
      { table: 'mangoes', columns: { id: 'number' } },
    ])
    const applesIdx = out.indexOf('apples:')
    const mangoesIdx = out.indexOf('mangoes:')
    const zebrasIdx = out.indexOf('zebras:')
    expect(applesIdx).toBeLessThan(mangoesIdx)
    expect(mangoesIdx).toBeLessThan(zebrasIdx)
  })
})

describe('buildDatabaseSchema — walks model files end-to-end', () => {
  test('returns empty schema with no errors when no models exist', async () => {
    const root = mkScratch()
    const result = await buildDatabaseSchema({
      modelsDir: join(root, 'no-models-here'),
      defaultsDir: join(root, 'also-missing'),
      outFile: join(root, 'database/types.d.ts'),
    })
    expect(result.tables).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })

  test('emits one DatabaseSchema entry per registered model', async () => {
    const root = mkScratch()
    const modelsDir = join(root, 'app/Models')
    const outFile = join(root, 'database/types.d.ts')

    writeModel(modelsDir, 'Judge.ts', `
      export default {
        name: 'Judge',
        table: 'judges',
        traits: { useTimestamps: true },
        attributes: {
          name: { type: 'string' },
          courtId: { type: 'integer' },
          isActive: { type: 'boolean', nullable: true },
        },
        belongsTo: ['CourtHouse'],
      }
    `)
    writeModel(modelsDir, 'CourtHouse.ts', `
      export default {
        name: 'CourtHouse',
        table: 'court_houses',
        traits: { useUuid: true, useTimestamps: true, useSoftDeletes: true },
        attributes: {
          name: { type: 'string' },
          metadata: { type: 'json' },
        },
      }
    `)

    const result = await buildDatabaseSchema({
      modelsDir,
      defaultsDir: join(root, 'no-defaults'),
      outFile,
    })

    expect(existsSync(outFile)).toBe(true)
    const file = readFileSync(outFile, 'utf-8')

    // Both tables present, alphabetical order
    expect(file).toContain('court_houses:')
    expect(file).toContain('judges:')
    expect(file.indexOf('court_houses:')).toBeLessThan(file.indexOf('judges:'))

    // Judge columns: system + attrs + FK
    expect(file).toContain('court_id: number')   // FK from belongsTo
    expect(file).toContain('is_active: boolean | null')
    expect(file).toContain('name: string')

    // CourtHouse: uuid + soft-delete columns
    expect(file).toContain('uuid: string')
    expect(file).toContain('deleted_at: string | null')

    // JSON columns become unknown
    expect(file).toContain('metadata: unknown')
  })

  test('user models override framework defaults with the same name', async () => {
    const root = mkScratch()
    const modelsDir = join(root, 'app/Models')
    const defaultsDir = join(root, 'defaults/Models')

    writeModel(defaultsDir, 'User.ts', `
      export default {
        name: 'User',
        table: 'users',
        attributes: { email: { type: 'string' } },
      }
    `)
    writeModel(modelsDir, 'User.ts', `
      export default {
        name: 'User',
        table: 'users',
        attributes: {
          email: { type: 'string' },
          companyName: { type: 'string' },  // userland-only column
        },
      }
    `)

    const result = await buildDatabaseSchema({
      modelsDir,
      defaultsDir,
      outFile: join(root, 'database/types.d.ts'),
    })

    expect(result.tables).toHaveLength(1)
    expect(result.tables[0]!.columns).toHaveProperty('company_name')
  })

  test('dry-run produces content but writes no file', async () => {
    const root = mkScratch()
    const modelsDir = join(root, 'app/Models')
    const outFile = join(root, 'database/types.d.ts')

    writeModel(modelsDir, 'Judge.ts', `
      export default { name: 'Judge', table: 'judges', attributes: { name: { type: 'string' } } }
    `)

    const result = await buildDatabaseSchema({
      modelsDir,
      defaultsDir: join(root, 'no-defaults'),
      outFile,
      dryRun: true,
    })

    expect(result.content).toContain('judges:')
    expect(existsSync(outFile)).toBe(false)
  })

  test('records non-model files without aborting the run', async () => {
    const root = mkScratch()
    const modelsDir = join(root, 'app/Models')
    const outFile = join(root, 'database/types.d.ts')

    // Empty default export — not a model, should be silently dropped.
    writeModel(modelsDir, 'NotAModel.ts', `export default {}`)
    writeModel(modelsDir, 'Judge.ts', `
      export default { name: 'Judge', table: 'judges', attributes: { name: { type: 'string' } } }
    `)

    const result = await buildDatabaseSchema({
      modelsDir,
      defaultsDir: join(root, 'no-defaults'),
      outFile,
    })

    expect(result.tables).toHaveLength(1)
    expect(result.tables[0]!.model).toBe('Judge')
  })
})

describe('attribute → TS type mapping', () => {
  // These cases are covered indirectly above; this block pins specific
  // dialect-adjacent mappings (bigint, datetime, blob) where it's easy
  // to silently regress to `unknown` if the switch loses a case.
  test('bigint → number | bigint, datetime → string, blob → Uint8Array', async () => {
    const root = mkScratch()
    const modelsDir = join(root, 'app/Models')
    const outFile = join(root, 'database/types.d.ts')

    writeModel(modelsDir, 'WideModel.ts', `
      export default {
        name: 'WideModel',
        table: 'wide_models',
        attributes: {
          counter: { type: 'bigint' },
          publishedAt: { type: 'datetime' },
          payload: { type: 'blob' },
          rating: { type: 'decimal' },
        },
      }
    `)

    const result = await buildDatabaseSchema({
      modelsDir,
      defaultsDir: join(root, 'no-defaults'),
      outFile,
    })
    const file = readFileSync(outFile, 'utf-8')
    expect(file).toContain('counter: number | bigint')
    expect(file).toContain('published_at: string')
    expect(file).toContain('payload: Uint8Array')
    expect(file).toContain('rating: number')
  })
})

describe('belongsToMany pivot tables (stacksjs/stacks#1938)', () => {
  test('emits a pivot table for a string-form belongsToMany', async () => {
    const root = mkScratch()
    const modelsDir = join(root, 'app/Models')
    const outFile = join(root, 'database/types.d.ts')

    writeModel(modelsDir, 'User.ts', `
      export default {
        name: 'User',
        table: 'users',
        attributes: { email: { type: 'string' } },
        belongsToMany: ['Role'],
      }
    `)
    writeModel(modelsDir, 'Role.ts', `
      export default {
        name: 'Role',
        table: 'roles',
        attributes: { name: { type: 'string' } },
      }
    `)

    const result = await buildDatabaseSchema({ modelsDir, defaultsDir: join(root, 'no-defaults'), outFile })
    // 2 model tables + 1 pivot.
    expect(result.tables.map(t => t.table).sort()).toEqual(['role_user', 'roles', 'users'])
    const file = readFileSync(outFile, 'utf-8')
    expect(file).toContain('role_user:')
    expect(file).toContain('user_id: number')
    expect(file).toContain('role_id: number')
  })

  test('uses alphabetical convention so both sides produce the same table (deduped)', async () => {
    const root = mkScratch()
    const modelsDir = join(root, 'app/Models')

    writeModel(modelsDir, 'User.ts', `
      export default { name: 'User', attributes: {}, belongsToMany: ['Role'] }
    `)
    writeModel(modelsDir, 'Role.ts', `
      export default { name: 'Role', attributes: {}, belongsToMany: ['User'] }
    `)

    const result = await buildDatabaseSchema({
      modelsDir,
      defaultsDir: join(root, 'no-defaults'),
      outFile: join(root, 'database/types.d.ts'),
    })

    const pivotTables = result.tables.filter(t => t.model.includes('pivot')).map(t => t.table)
    expect(pivotTables).toEqual(['role_user']) // exactly one, not duplicated
  })

  test('respects pivotTable + firstForeignKey + secondForeignKey overrides', async () => {
    const root = mkScratch()
    const modelsDir = join(root, 'app/Models')

    writeModel(modelsDir, 'User.ts', `
      export default {
        name: 'User',
        attributes: {},
        belongsToMany: [{
          model: 'Role',
          pivotTable: 'user_role_assignments',
          firstForeignKey: 'assignee_id',
          secondForeignKey: 'granted_role_id',
        }],
      }
    `)
    writeModel(modelsDir, 'Role.ts', `
      export default { name: 'Role', attributes: {} }
    `)

    const result = await buildDatabaseSchema({
      modelsDir,
      defaultsDir: join(root, 'no-defaults'),
      outFile: join(root, 'database/types.d.ts'),
    })

    const pivot = result.tables.find(t => t.table === 'user_role_assignments')
    expect(pivot).toBeDefined()
    expect(pivot!.columns).toHaveProperty('assignee_id', 'number')
    expect(pivot!.columns).toHaveProperty('granted_role_id', 'number')
  })

  test('pivot rows carry id + timestamps', async () => {
    const root = mkScratch()
    const modelsDir = join(root, 'app/Models')

    writeModel(modelsDir, 'User.ts', `
      export default { name: 'User', attributes: {}, belongsToMany: ['Role'] }
    `)
    writeModel(modelsDir, 'Role.ts', `
      export default { name: 'Role', attributes: {} }
    `)

    const result = await buildDatabaseSchema({
      modelsDir,
      defaultsDir: join(root, 'no-defaults'),
      outFile: join(root, 'database/types.d.ts'),
    })
    const pivot = result.tables.find(t => t.table === 'role_user')!
    expect(pivot.columns).toHaveProperty('id', 'number')
    expect(pivot.columns).toHaveProperty('created_at', 'string')
    expect(pivot.columns).toHaveProperty('updated_at', 'string | null')
  })
})
