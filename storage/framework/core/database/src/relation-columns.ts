/**
 * Relation-derived foreign key columns.
 *
 * A model's schema is not just its `attributes`. Declaring
 * `belongsTo: ['User']` puts a `user_id` column on that model's table — the
 * ORM writes it (`processHasOneAndMany`'s `modelKey`), the type codegen emits
 * it (`deriveFkColumns` in generate-database-schema.ts), and userland reads it
 * — but the column is never declared in `attributes`, because declaring it
 * would also make it fillable and filterable through the auto-generated API,
 * which is exactly wrong for a tenancy key: a farm's `user_id` is who OWNS the
 * row, and a POST that can set it is a POST that can steal it.
 *
 * The model-first schema differ builds each table's expected column set from
 * `attributes` alone. So every relation key that isn't ALSO declared as an
 * attribute reads as "in the database but not in the model", and `buddy
 * migrate` proposes dropping it — on SQLite, by rebuilding the table without
 * it. That is a destructive change proposed on every single run, against the
 * column that decides who owns the row.
 *
 * This resolves those columns so the guards in `managed-columns.ts` can treat
 * them as what they are: part of the model. Same shape as `uuid-columns.ts`'s
 * `findUuidTables` — walk the model files rather than enumerate tables by
 * hand, so it covers userland and framework defaults, now and later.
 */

import type { Model } from '@stacksjs/types'
import { getTableName } from '@stacksjs/orm'
import { path } from '@stacksjs/path'
import { fs } from '@stacksjs/storage'

/** Local rather than imported from `@stacksjs/strings`, to match the identical helper the type codegen uses to derive these same column names. */
function snakeCase(str: string): string {
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .replace(/(\d)([A-Za-z])/g, '$1_$2')
    .toLowerCase()
}

/**
 * The foreign key a single `belongsTo` entry puts on the declaring model's
 * table. Accepts both forms the type allows: a bare model name, and the
 * object form with an explicit `foreignKey`.
 */
export function belongsToColumn(entry: unknown): string | null {
  if (typeof entry === 'string')
    return entry.length > 0 ? `${snakeCase(entry)}_id` : null

  if (entry && typeof entry === 'object') {
    const relation = entry as { model?: unknown, foreignKey?: unknown }
    if (typeof relation.foreignKey === 'string' && relation.foreignKey.length > 0)
      return relation.foreignKey
    if (typeof relation.model === 'string' && relation.model.length > 0)
      return `${snakeCase(relation.model)}_id`
  }

  return null
}

/** Every foreign key column a model's `belongsTo` declarations imply. */
export function belongsToColumnsOf(model: Model): string[] {
  const declared = (model as { belongsTo?: unknown }).belongsTo
  if (!declared)
    return []

  // Both the array form (`['User']`) and the record form some models use.
  const entries: unknown[] = Array.isArray(declared)
    ? declared
    : Object.entries(declared as Record<string, unknown>).map(([model, value]) => (
        value && typeof value === 'object' ? { model, ...(value as object) } : model
      ))

  const columns: string[] = []
  for (const entry of entries) {
    const column = belongsToColumn(entry)
    if (column)
      columns.push(column)
  }

  return columns
}

/**
 * Walk a models directory recursively and load each default export. Mirrors
 * `uuid-columns.ts`'s loader, including its tolerance: one unreadable model
 * file must not cost every other model its protection.
 */
async function loadModelsFrom(dir: string): Promise<Array<{ filePath: string, model: Model }>> {
  const out: Array<{ filePath: string, model: Model }> = []
  if (!fs.existsSync(dir))
    return out

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await loadModelsFrom(fullPath)))
      continue
    }
    if (!entry.name.endsWith('.ts'))
      continue
    if (entry.name.startsWith('_') || entry.name.startsWith('index'))
      continue

    try {
      const imported = (await import(fullPath)).default as Model
      if (imported?.name || imported?.table)
        out.push({ filePath: fullPath, model: imported })
    }
    catch {
      // Per-file failure is non-fatal — same tolerance as the schema codegen.
    }
  }

  return out
}

/**
 * Resolve `table -> relation foreign key columns` across userland and
 * framework-default models.
 *
 * A column that IS declared in `attributes` needs no protection — the differ
 * already expects it — but including it changes nothing, since the guards only
 * ever suppress drops of columns in this set and the differ never proposes
 * dropping a column it expects.
 */
export async function findRelationForeignKeys(): Promise<Map<string, Set<string>>> {
  const dirs = [path.userModelsPath(), path.frameworkPath('defaults/app/Models')]
  const byTable = new Map<string, Set<string>>()

  for (const dir of dirs) {
    for (const { filePath, model } of await loadModelsFrom(dir)) {
      const columns = belongsToColumnsOf(model)
      if (columns.length === 0)
        continue

      const table = getTableName(model, filePath) as unknown as string
      const existing = byTable.get(table) ?? new Set<string>()
      for (const column of columns)
        existing.add(column)
      byTable.set(table, existing)
    }
  }

  return byTable
}
