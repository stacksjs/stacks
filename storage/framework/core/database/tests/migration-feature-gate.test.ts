/**
 * Migration feature-gate tests (stacksjs/stacks#1854).
 *
 * Verifies the `hideDisabledFeatureMigrations` pre-flight pass in
 * `runDatabaseMigration` renames feature-owned `.sql` files to
 * `.sql.disabled` before running and restores them on completion. The
 * helper is private to `migrations.ts` so these tests reach in via the
 * public `runDatabaseMigration` surface where practical, and via a
 * direct re-implementation of the same rename logic where the DB
 * side-effects would make a full migration run impractical to mock.
 *
 * The gating logic itself lives in `@stacksjs/buddy`'s `features.ts`
 * (`FEATURE_TABLES`, `migrationFeature`). This test focuses on the
 * filesystem behavior: hide → run → restore, no orphan `.disabled`
 * files left behind.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readdirSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrationFeature, migrationTable } from '../../buddy/src/commands/features'

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'stacks-mig-gate-'))
})

afterEach(async () => {
  if (root) {
    try { await rm(root, { recursive: true, force: true }) }
    catch { /* ignore */ }
  }
})

/**
 * Mirror of `hideDisabledFeatureMigrations`'s filesystem moves, isolated
 * from the runner so we don't need a live DB to exercise it. The
 * runner version of this loop is what ships; this version is a 1:1
 * translation that takes the "disabled features" set as input rather
 * than reading config.
 */
async function hideForFeatures(
  migrationsDir: string,
  disabledFeatures: ReadonlySet<string>,
): Promise<Array<{ original: string, hidden: string, feature: string }>> {
  const fs = await import('node:fs/promises')
  const hidden: Array<{ original: string, hidden: string, feature: string }> = []
  const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql'))
  for (const file of files) {
    const owner = migrationFeature(file)
    if (!owner || !disabledFeatures.has(owner)) continue
    const original = join(migrationsDir, file)
    const hiddenPath = `${original}.disabled`
    await fs.rename(original, hiddenPath)
    hidden.push({ original, hidden: hiddenPath, feature: owner })
  }
  return hidden
}

async function restoreHidden(hidden: Array<{ original: string, hidden: string }>): Promise<void> {
  const fs = await import('node:fs/promises')
  for (const { original, hidden: h } of hidden) {
    try { await fs.rename(h, original) }
    catch { /* best-effort */ }
  }
}

describe('Migration feature-gate — filesystem pass', () => {
  test('hides migrations owned by disabled features and leaves the rest alone', async () => {
    const dir = join(root, 'database/migrations')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, '0000000045-create-posts-table.sql'), '-- cms')
    await writeFile(join(dir, '0000000099-create-comments-table.sql'), '-- cms')
    await writeFile(join(dir, '0000000095-create-users-table.sql'), '-- core')
    await writeFile(join(dir, '0000000101-create-roles-table.sql'), '-- core')

    const hidden = await hideForFeatures(dir, new Set(['cms']))

    expect(hidden.length).toBe(2)
    expect(hidden.every(h => h.feature === 'cms')).toBe(true)
    expect(existsSync(join(dir, '0000000045-create-posts-table.sql'))).toBe(false)
    expect(existsSync(join(dir, '0000000045-create-posts-table.sql.disabled'))).toBe(true)
    expect(existsSync(join(dir, '0000000095-create-users-table.sql'))).toBe(true)
    expect(existsSync(join(dir, '0000000101-create-roles-table.sql'))).toBe(true)
  })

  test('alter migrations on feature-owned tables get hidden too', async () => {
    const dir = join(root, 'database/migrations')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, '0000000045-create-posts-table.sql'), '-- cms')
    await writeFile(join(dir, '0000000085-alter-posts-author_id.sql'), '-- cms alter')

    const hidden = await hideForFeatures(dir, new Set(['cms']))

    expect(hidden.length).toBe(2)
    expect(existsSync(join(dir, '0000000085-alter-posts-author_id.sql'))).toBe(false)
    expect(existsSync(join(dir, '0000000085-alter-posts-author_id.sql.disabled'))).toBe(true)
  })

  test('index migrations route by the trailing -in-<table>.sql segment', async () => {
    const dir = join(root, 'database/migrations')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, '0000000086-create-payments_transaction_id_unique-index-in-payments.sql'), '-- commerce idx')

    const hidden = await hideForFeatures(dir, new Set(['commerce']))

    expect(hidden.length).toBe(1)
    expect(migrationTable('0000000086-create-payments_transaction_id_unique-index-in-payments.sql')).toBe('payments')
  })

  test('restore renames `.sql.disabled` back to `.sql`', async () => {
    const dir = join(root, 'database/migrations')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, '0000000045-create-posts-table.sql'), '-- cms')

    const hidden = await hideForFeatures(dir, new Set(['cms']))
    expect(existsSync(join(dir, '0000000045-create-posts-table.sql'))).toBe(false)

    await restoreHidden(hidden)
    expect(existsSync(join(dir, '0000000045-create-posts-table.sql'))).toBe(true)
    expect(existsSync(join(dir, '0000000045-create-posts-table.sql.disabled'))).toBe(false)
  })

  test('no-op when no features are disabled', async () => {
    const dir = join(root, 'database/migrations')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, '0000000045-create-posts-table.sql'), '-- cms')

    const hidden = await hideForFeatures(dir, new Set())
    expect(hidden).toEqual([])
    expect(existsSync(join(dir, '0000000045-create-posts-table.sql'))).toBe(true)
  })

  test('no-op for migrations not claimed by any feature', async () => {
    const dir = join(root, 'database/migrations')
    await mkdir(dir, { recursive: true })
    // Standalone migration not in any feature's table list.
    await writeFile(join(dir, '0000000098-revoke-legacy-long-lived-tokens.sql'), '-- core')

    const hidden = await hideForFeatures(dir, new Set(['cms', 'commerce', 'dashboard', 'marketing', 'monitoring', 'realtime', 'queue']))
    expect(hidden).toEqual([])
    expect(existsSync(join(dir, '0000000098-revoke-legacy-long-lived-tokens.sql'))).toBe(true)
  })

  test('hide + restore is idempotent — re-running leaves the directory clean', async () => {
    const dir = join(root, 'database/migrations')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, '0000000045-create-posts-table.sql'), '-- cms')
    await writeFile(join(dir, '0000000095-create-users-table.sql'), '-- core')

    for (let i = 0; i < 3; i++) {
      const hidden = await hideForFeatures(dir, new Set(['cms']))
      await restoreHidden(hidden)
    }

    // Both .sql files should still be present, no .disabled stragglers.
    const files = readdirSync(dir)
    expect(files).toContain('0000000045-create-posts-table.sql')
    expect(files).toContain('0000000095-create-users-table.sql')
    expect(files.filter(f => f.endsWith('.disabled'))).toEqual([])
  })
})
