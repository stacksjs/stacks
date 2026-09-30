type UserModel = NonNullable<Awaited<ReturnType<typeof User.find>>>
import { db, getDatabaseDialect, sqlHelpers } from '@stacksjs/database/runtime'
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
  // `sql.param()` renders the placeholder this dialect accepts. A tagged
  // template interpolates a literal `?`, which Postgres parses as an operator
  // and then rejects at the next token: every query here failed with
  // `syntax error at or near "LIMIT"`, taking the whole Postgres auth suite
  // with it, because every login resolves its user through this function.
  const sql = sqlHelpers(getDatabaseDialect())
  const softDelete = definition.traits?.useSoftDeletes ? ' AND deleted_at IS NULL' : ''
  const exact = await db.primary.unsafe(
    `SELECT * FROM ${table} WHERE email = ${sql.param(1)}${softDelete} LIMIT 1`,
    [email],
  ) as Record<string, unknown>[]
  if (exact[0])
    return exact[0]

  // Canonical rows use the unique email index. The fallback keeps accounts
  // created before canonicalization usable on case-sensitive databases.
  const fallback = await db.primary.unsafe(
    `SELECT * FROM ${table} WHERE LOWER(email) = ${sql.param(1)}${softDelete} LIMIT 1`,
    [email],
  ) as Record<string, unknown>[]
  return fallback[0]
}

/** Resolve an email without making existing mixed-case accounts unloginable. */
export async function findAuthUserByEmail(value: string): Promise<UserModel | undefined> {
  const row = await findAuthUserRowByEmail(value)
  return row ? await User.make(row) as UserModel : undefined
}
