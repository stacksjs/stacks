/**
 * The feature manifest, checked against the thing it describes.
 *
 * `FEATURE_TABLES` decides whether a migration runs. When it drifts from the
 * models and migrations it claims to describe, the failure is not a wrong
 * answer from a function - it is a migration run that dies partway through
 * against a database it half-created.
 *
 * That has now happened three times, each recorded in a comment in the
 * manifest rather than in a test: the commerce delivery tables, the auction
 * tables, and `campaign_variants`. Every one was the same shape - a table with
 * a foreign key to a feature-owned parent, itself unclaimed, so the gate hid
 * the parent and ran the child. A comment does not fail CI. These do.
 *
 * The invariants are derived from the corpus on disk rather than restated as a
 * list, so a new model or migration is checked the moment it lands.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'bun:test'
import {
  appModelClaimsTable,
  FEATURE_FILES,
  FEATURE_NAMES,
  FEATURE_TABLES,
  migrationFeature,
  migrationTable,
} from '../src/index'

// Anchored to this file, not the working directory. Reading `database/
// migrations` relative to the CWD passes only because the suite happens to be
// launched from the repository root.
const REPO_ROOT = join(import.meta.dir, '../../../../..')
const MIGRATIONS = join(REPO_ROOT, 'database/migrations')
const DEFAULT_MODELS = join(REPO_ROOT, 'storage/framework/defaults/app/Models')

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory()
      ? walk(join(dir, entry.name))
      : entry.name.endsWith('.ts') ? [join(dir, entry.name)] : [])
}

/** Every table any feature claims. */
const claimedTables = new Set(FEATURE_NAMES.flatMap(f => [...FEATURE_TABLES[f]]))

/** `table -> migration filename that creates it`, from the real corpus. */
const createdBy = new Map<string, string>()
for (const file of readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql'))) {
  if (!/-create-.*-table\.sql$/.test(file)) continue
  const table = migrationTable(file)
  if (table) createdBy.set(table, file)
}

/** The default models, with the table each declares and the feature owning its file. */
const models = walk(DEFAULT_MODELS).map((abs) => {
  const source = readFileSync(abs, 'utf8')
  const rel = `app/Models/${relative(DEFAULT_MODELS, abs)}`
  return {
    rel,
    table: source.match(/table:\s*'([^']+)'/)?.[1] ?? null,
    fileOwner: FEATURE_NAMES.find(f =>
      FEATURE_FILES[f].some(claim => claim.endsWith('/') ? rel.startsWith(claim) : rel === claim)) ?? null,
  }
})

const tableOwner = (table: string) => FEATURE_NAMES.find(f => (FEATURE_TABLES[f] as readonly string[]).includes(table)) ?? null

describe('the manifest describes the corpus on disk', () => {
  it('never lets two features claim one table', () => {
    // `migrationFeature` returns the first match in `FEATURE_NAMES` order, so a
    // table claimed twice is gated by whichever feature happens to be declared
    // first - which is not a decision anyone made.
    const owners = new Map<string, string[]>()
    for (const feature of FEATURE_NAMES)
      for (const table of FEATURE_TABLES[feature])
        owners.set(table, [...(owners.get(table) ?? []), feature])

    expect(Object.fromEntries([...owners].filter(([, fs]) => fs.length > 1))).toEqual({})
  })

  it('claims no table that no migration creates', () => {
    // A stale claim gates nothing, but it reads as coverage the manifest does
    // not have - and it hides the table's real owner when one is finally added.
    expect([...claimedTables].filter(t => !createdBy.has(t)).sort()).toEqual([])
  })

  it('claims every table whose migration keys into a feature-owned parent', () => {
    // THE regression test. An unclaimed child of a gated parent is the failure
    // that has recurred three times.
    const orphans: Record<string, string[]> = {}
    for (const [table, file] of createdBy) {
      if (claimedTables.has(table)) continue
      const parents = [...new Set(
        [...readFileSync(join(MIGRATIONS, file), 'utf8')
          .matchAll(/references\s+["`']?([a-z0-9_]+)["`']?/gi)].map(m => m[1]!),
      )].filter(parent => parent !== table && claimedTables.has(parent))

      if (parents.length) orphans[table] = parents
    }

    expect(orphans).toEqual({})
  })

  it('never lets one feature install a model whose table another feature gates', () => {
    // The hazard is asymmetric. An UNCLAIMED table always runs, so a feature
    // installing a model with no claim on its table is safe - that is exactly
    // the arrangement `categories` is in, deliberately. What breaks is a table
    // claimed by a DIFFERENT feature: disable that one and the gate hides the
    // table out from under a model this one just copied in.
    const split: Record<string, string> = {}
    for (const model of models) {
      if (!model.fileOwner || !model.table) continue
      const owner = tableOwner(model.table)
      if (owner !== null && owner !== model.fileOwner)
        split[model.rel] = `file -> ${model.fileOwner}, table '${model.table}' -> ${owner}`
    }

    expect(split).toEqual({})
  })

})

describe('migrationTable', () => {
  it('reads the table out of each filename shape the generator emits', () => {
    expect(migrationTable('0000000045-create-posts-table.sql')).toBe('posts')
    expect(migrationTable('0000000085-alter-posts-author_id.sql')).toBe('posts')
    expect(migrationTable('0000000147-create-posts_slug_unique-index-in-posts.sql')).toBe('posts')
  })

  it('prefers the trailing -in-<table> over the leading index name', () => {
    // The leading segment carries the index name, which starts with the table
    // but is not it. Reading that segment would gate on `posts_slug_unique`.
    expect(migrationTable('0000000147-create-campaign_variants_name_unique-index-in-campaign_variants.sql'))
      .toBe('campaign_variants')
  })

  it('returns null for anything it does not recognise, so the migration runs', () => {
    // The safe direction: an unclassifiable migration is kept, never hidden.
    expect(migrationTable('0000000134-auto-misc.sql')).toBeNull()
    expect(migrationTable('0000000166-sync-team-member-counts.sql')).toBeNull()
    expect(migrationTable('1785502251814-repair-seeded-image-urls.sql')).toBeNull()
  })
})

describe('migrationFeature', () => {
  it('names the owning feature of a claimed table', () => {
    expect(migrationFeature('0000000045-create-posts-table.sql')).toBe('cms')
    expect(migrationFeature('1785502251839-create-campaign_variants-table.sql')).toBe('marketing')
  })

  it('leaves an unclaimed or unparseable migration ungated', () => {
    expect(migrationFeature('0000000001-create-storage_items-table.sql')).toBeNull()
    expect(migrationFeature('0000000134-auto-misc.sql')).toBeNull()
  })
})

describe('appModelClaimsTable', () => {
  it('is false when the project declares no models of its own', () => {
    // The framework checkout has no root `app/Models/*.ts`, so nothing here
    // overrides the gate - which is what makes the gate observable at all.
    expect(appModelClaimsTable('subscribers')).toBe(false)
  })

  it('is false for a project directory that does not exist', () => {
    expect(appModelClaimsTable('posts', '/nonexistent-project-root')).toBe(false)
  })
})
