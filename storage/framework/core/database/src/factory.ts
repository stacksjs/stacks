/**
 * Stacks-native factory API (stacksjs/stacks#1919).
 *
 * The canonical replacement for the `useSeeder` trait auto-walker. The
 * walker fires unconditionally during `./buddy seed` and double-seeds
 * any table that *also* has a class seeder file. `factory.generate`
 * flips that around: factories are values you invoke explicitly from a
 * class seeder, so there's exactly one orchestration layer per table.
 *
 * ```ts
 * import { factory } from '@stacksjs/database'
 * import Judge from '../app/Models/Judge'
 *
 * await factory.generate(Judge, { count: 50 })
 * await factory.generate(Judge, { count: 10, with: { practice_area: 'appellate' } })
 * await factory.generate(Judge, { rows: [{ name: 'Hon. Roberts' }, { name: 'Hon. Sotomayor' }] })
 * ```
 *
 * See the `useSeeder` trait deprecation in `seeder.ts` for the back-
 * compat plan.
 */

import type { Attribute, Model, SeedOptions } from '@stacksjs/types'
import { log } from '@stacksjs/logging'
import { seedModelDirect } from './seeder'
import type { SeedResult } from './seeder'

export interface GenerateOptions {
  /** Number of rows to generate. Defaults to 10. */
  count?: number
  /** Truncate the table before inserting. */
  fresh?: boolean
  /** Per-row verbose logging (factory failure breakdown). */
  verbose?: boolean
  /**
   * Column overrides applied to *every* generated row. Keys use the
   * model's attribute names (camelCase); they're snake-cased to
   * match column names before insert. Useful for "give me 10
   * appellate judges with faker-generated names":
   *
   * ```ts
   * factory.generate(Judge, { count: 10, with: { practiceArea: 'appellate' } })
   * ```
   */
  with?: Record<string, unknown>
  /**
   * Curated rows merged over the factory output. The first
   * `rows.length` generated records are overridden column-by-column;
   * remaining rows (if `count > rows.length`) are pure faker output.
   * Same shape as the legacy `useSeeder.fixtures` array.
   */
  rows?: Array<Record<string, unknown>>
}

/**
 * Resolve the runtime model definition out of whatever shape userland
 * actually exported. Stacks model files traditionally `export default
 * { name, table, attributes, traits } as const` (a `Model`). The
 * `defineModel` wrapper from `@stacksjs/orm` returns the bun-query-
 * builder model object, on which the original definition lives as
 * `._definition` — accept that form too so callers don't have to know
 * which export shape they're holding.
 */
function resolveDefinition(input: unknown): Model {
  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown> & { _definition?: Model }
    if (obj._definition && typeof obj._definition === 'object' && 'name' in obj._definition) {
      return obj._definition as Model
    }
    if ('name' in obj && ('attributes' in obj || 'table' in obj || 'traits' in obj)) {
      return obj as Model
    }
  }
  throw new Error(
    'factory.generate: expected a Stacks model (the default export of app/Models/*.ts, '
    + 'or a defineModel() return value). Got something without a `.name` field.',
  )
}

function snakeCase(str: string): string {
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .replace(/(\d)([A-Za-z])/g, '$1_$2')
    .toLowerCase()
}

function snakeCaseKeys(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input))
    out[snakeCase(key)] = value
  return out
}

/**
 * Build the internal `SeederModel`-shaped payload that `seedModelDirect`
 * expects from a public-API call. Pure function — exported separately
 * so tests can assert the override-precedence rules without touching
 * the database.
 *
 * Precedence (lowest → highest): per-attribute `factory` output →
 * global `options.with` → per-row `options.rows[i]`. All keys are
 * snake-cased before insert so callers can use the model's camelCase
 * attribute names without thinking about column naming.
 */
export function buildSeederPayload(modelInput: unknown, options: GenerateOptions = {}): {
  name: string
  table: string
  count: number
  fixtures: Array<Record<string, unknown>>
  attributes: Record<string, Attribute>
  model: Model
} {
  const def = resolveDefinition(modelInput)
  const name = def.name as string
  const attributes = (def.attributes ?? {}) as Record<string, Attribute>

  const useSeederConfig = def.traits?.useSeeder
  const seederDefault: SeedOptions | undefined = (useSeederConfig && typeof useSeederConfig === 'object')
    ? useSeederConfig as SeedOptions
    : undefined
  const count = options.count ?? seederDefault?.count ?? 10

  const globalOverrides = options.with ? snakeCaseKeys(options.with) : undefined
  const perRow = options.rows ?? seederDefault?.fixtures ?? []
  const fixtureCount = Math.max(count, perRow.length)

  const fixtures: Array<Record<string, unknown>> = []
  for (let i = 0; i < fixtureCount; i++) {
    const row = perRow[i]
    if (!globalOverrides && !row) continue
    fixtures[i] = { ...(globalOverrides ?? {}), ...(row ? snakeCaseKeys(row) : {}) }
  }

  const table = (def.table as string | undefined) ?? `${snakeCase(name)}s`

  return { name, table, count: fixtureCount, fixtures, attributes, model: def }
}

/**
 * Generate factory rows for a model and insert them. Designed to be
 * called from a class seeder.
 *
 * Honours the model's per-attribute `factory: faker => …` declarations
 * — exactly the same code path as the legacy auto-walker — but without
 * the implicit "every model with `useSeeder` fires on every run"
 * coupling. See stacksjs/stacks#1919 for the rationale.
 */
export async function generate(modelInput: unknown, options: GenerateOptions = {}): Promise<SeedResult> {
  const payload = buildSeederPayload(modelInput, options)

  try {
    return await seedModelDirect({
      ...payload,
      filePath: '',
    }, {
      fresh: options.fresh,
      verbose: options.verbose ?? false,
    })
  }
  catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    log.error(`[factory] generate(${payload.name}) failed: ${message}`)
    throw err
  }
}

export const factory = {
  generate,
} as const
