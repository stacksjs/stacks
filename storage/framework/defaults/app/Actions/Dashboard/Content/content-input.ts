import type { RequestInstance } from '@stacksjs/types'
import { db } from '@stacksjs/database'

/**
 * Helpers shared by the `Dashboard/Content` CRUD actions.
 *
 * These actions talk to `db` directly rather than going through the ORM models
 * or `@stacksjs/cms`: the models expose no query methods, and the CMS helpers
 * assume columns and pivot tables this schema does not have. See
 * `PostIndexAction` for the longer version of that story.
 */

export function str(value: unknown): string {
  return value == null ? '' : String(value)
}

/** `YYYY-MM-DD HH:MM:SS`, matching the tables' CURRENT_TIMESTAMP default. */
export function timestamp(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

/** The new row's id, across the driver shapes we may get back from an insert. */
export function insertedId(result: unknown): number {
  const row = result as { lastInsertRowid?: number | bigint, insertId?: number | bigint } | undefined

  return Number(row?.lastInsertRowid ?? row?.insertId ?? 0)
}

/** The `{id}` route param, or 0 when it is not a usable row id. */
export function rowId(request: RequestInstance): number {
  const id = Number(request.getParam('id'))

  return Number.isInteger(id) && id > 0 ? id : 0
}

/** Matches the slug the dashboard dialogs generate client-side. */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Reads a row back after a write.
 *
 * The SQLite driver in use does not honour `RETURNING` — `.returningAll()`
 * resolves to a `{ changes, lastInsertRowid }` summary rather than the row — so
 * writes re-select instead of trusting the insert/update result.
 *
 * `table` is a literal at every call site; the cast is only here because the
 * query builder's types want a table union rather than a `string`.
 */
export async function findRow(table: string, id: number): Promise<unknown> {
  return await (db as any).selectFrom(table).selectAll().where('id', '=', id).executeTakeFirst()
}

/** Whether a row with this id exists — the 404 check every write shares. */
export async function rowExists(table: string, id: number): Promise<boolean> {
  const row = await (db as any).selectFrom(table).select(['id']).where('id', '=', id).executeTakeFirst()

  return Boolean(row)
}
