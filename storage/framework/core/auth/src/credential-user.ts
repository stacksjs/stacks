type UserModel = NonNullable<Awaited<ReturnType<typeof User.find>>>
import { db, sql } from '@stacksjs/database/runtime'
import { User } from '@stacksjs/orm'

export function normalizeAuthEmail(value: string): string {
  return value.trim().toLowerCase()
}

/** Resolve an email without making existing mixed-case accounts unloginable. */
export async function findAuthUserByEmail(value: string): Promise<UserModel | undefined> {
  const email = normalizeAuthEmail(value)
  if (!email)
    return undefined

  // Canonical rows use the unique email index. The fallback keeps accounts
  // created before canonicalization usable on case-sensitive databases.
  const exact = await User.where('email', '=', email).first()
  if (exact)
    return exact

  const definition: { table?: string, traits?: { useSoftDeletes?: unknown } } = User.getDefinition()
  const table = definition.table || 'users'
  if (!/^[A-Z_][A-Z0-9_]*$/i.test(table))
    throw new TypeError('Auth user table must be a plain SQL identifier.')
  const softDelete = definition.traits?.useSoftDeletes ? sql.raw(' AND deleted_at IS NULL') : sql.raw('')
  const query = sql`SELECT * FROM ${sql.raw(table)} WHERE LOWER(email) = ${email}${softDelete} LIMIT 1`
  const rows = await db.primary.unsafe(query.sql, query.parameters) as Record<string, unknown>[]
  const row = rows[0]
  return row ? await User.make(row) as UserModel : undefined
}
