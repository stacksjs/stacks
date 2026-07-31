// Every table a feature's default models create must be claimed by that
// feature.
//
// The migration gate hides a disabled feature's migrations by table name. A
// table missing from the manifest is not hidden, so it runs against a database
// where the tables it references were hidden — and the whole migration run dies
// on a foreign key to something that was deliberately left out. That is how
// `order_idempotency` broke `buddy migrate` for every app with commerce
// disabled, which is the default.
//
// This walks the models rather than restating the list, so a model added later
// fails here instead of in somebody's migration.

import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { FEATURE_NAMES, FEATURE_TABLES, migrationFeature } from '../src/commands/features'

/** Where a feature's default models live, for the features that ship them. */
const MODEL_DIRECTORIES: Partial<Record<string, string>> = {
  commerce: 'commerce',
  cms: 'Content',
}

function defaultsRoot(): string {
  return join(import.meta.dir, '../../../defaults/app/Models')
}

function tablesIn(directory: string): Array<{ table: string, file: string }> {
  const dir = join(defaultsRoot(), directory)
  if (!existsSync(dir))
    return []

  const found: Array<{ table: string, file: string }> = []
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.ts'))
      continue

    const match = readFileSync(join(dir, file), 'utf8').match(/table:\s*'([a-z0-9_]+)'/)
    if (match)
      found.push({ table: match[1]!, file })
  }

  return found
}

describe('feature table manifest', () => {
  for (const [feature, directory] of Object.entries(MODEL_DIRECTORIES)) {
    test(`every ${feature} model's table is claimed by a feature`, () => {
      const models = tablesIn(directory!)
      expect(models.length).toBeGreaterThan(0)

      const unclaimed = models.filter(({ table }) => (
        !FEATURE_NAMES.some(name => (FEATURE_TABLES[name] as readonly string[]).includes(table))
      ))

      expect(unclaimed.map(entry => `${entry.file} (${entry.table})`)).toEqual([])
    })
  }

  test('order_idempotency is owned by commerce', () => {
    // The specific miss that motivated this file: the table is created by a
    // commerce model and points at `orders`.
    expect(migrationFeature('0000000060-create-order_idempotency-table.sql')).toBe('commerce')
  })

  test('a migration for a table no feature owns is ungated', () => {
    expect(migrationFeature('0000000001-create-repositories-table.sql')).toBeNull()
  })

  test('no feature claims the same table twice', () => {
    for (const name of FEATURE_NAMES) {
      const tables = FEATURE_TABLES[name] as readonly string[]

      expect(new Set(tables).size).toBe(tables.length)
    }
  })
})
