type UserModel = NonNullable<Awaited<ReturnType<typeof User.find>>>
import { db, sql } from '@stacksjs/database/runtime'
import { User } from '@stacksjs/orm'

export function normalizeAuthEmail(value: string): string {
  return value.trim().toLowerCase()
}

/** Resolve the stored row without requiring the ORM model runtime to be booted. */
export async function findAuthUserRowByEmail(value: string): Promise<Record<string, unknown> | undefined> {
  const email = normalizeAuthEmail(value)
  if (!email)
    return undefined

  const definition: { table?: string, traits?: { useSoftDeletes?: unknown } }
    = typeof User.getDefinition === 'function' ? User.getDefinition() : {}
  const table = definition.table || 'users'
  if (!/^[A-Z_][A-Z0-9_]*$/i.test(table))
    throw new TypeError('Auth user table must be a plain SQL identifier.')
  const softDelete = definition.traits?.useSoftDeletes ? sql.raw(' AND deleted_at IS NULL') : sql.raw('')
  const exactQuery = sql`SELECT * FROM ${sql.raw(table)} WHERE email = ${email}${softDelete} LIMIT 1`
  const exact = await db.primary.unsafe(exactQuery.sql, exactQuery.parameters) as Record<string, unknown>[]
  if (exact[0])
    return exact[0]

  // Canonical rows use the unique email index. The fallback keeps accounts
  // created before canonicalization usable on case-sensitive databases.
  const fallbackQuery = sql`SELECT * FROM ${sql.raw(table)} WHERE LOWER(email) = ${email}${softDelete} LIMIT 1`
  const fallback = await db.primary.unsafe(fallbackQuery.sql, fallbackQuery.parameters) as Record<string, unknown>[]
  return fallback[0]
}

/** Resolve an email without making existing mixed-case accounts unloginable. */
export async function findAuthUserByEmail(value: string): Promise<UserModel | undefined> {
  const row = await findAuthUserRowByEmail(value)
  return row ? await User.make(row) as UserModel : undefined
}
