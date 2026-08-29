import type { DbWriteResult } from '@stacksjs/database'
import type { GiftCard, ModelRow, UpdateModelData } from '@stacksjs/orm'
import { db, sqlHelpers } from '@stacksjs/database'
import { env } from '@stacksjs/env'
import { HttpError } from '@stacksjs/error-handling'
import { formatDate, isUniqueViolation } from '@stacksjs/orm'
type GiftCardJsonResponse = ModelRow<typeof GiftCard>
type GiftCardUpdate = UpdateModelData<typeof GiftCard>
import { fetchById } from './fetch'

/**
 * Update a gift card by ID
 *
 * @param id The ID of the gift card to update
 * @param data The updated gift card data
 * @returns The updated gift card record
 */
export async function update(id: number, data: Omit<GiftCardUpdate, 'id'>): Promise<GiftCardJsonResponse | undefined> {
  // Check if gift card exists
  const existingGiftCard = await fetchById(id)
  if (!existingGiftCard)
    return undefined

  try {
    // Update the gift card
    await db
      .updateTable('gift_cards')
      .set({
        ...data,
        updated_at: formatDate(new Date()),
      })
      .where('id', '=', id)
      .execute()

    // Fetch and return the updated gift card
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof HttpError)
      throw error
    // Cross-dialect duplicate detection (#1957).
    if (isUniqueViolation(error))
      throw new HttpError(409, 'A gift card with this code already exists')
    if (error instanceof Error)
      throw new Error(`Failed to update gift card: ${error.message}`)
    throw error
  }
}

/**
 * Update a gift card's balance atomically (stacksjs/stacks#1879 Co-8).
 *
 * Pre-fix: read balance -> compute new -> write. Two parallel $50
 * redemptions of a $100 card both saw `current_balance = 100`,
 * both wrote `50`, leaving `50` instead of `0`. The post-read
 * negative-balance guard only caught single-threaded misuse.
 *
 * Post-fix: single conditional UPDATE that does the arithmetic and
 * enforces every precondition in the WHERE clause. The database
 * guarantees only one writer wins the race. Throws when the row
 * was found but the precondition failed (insufficient balance,
 * inactive, expired, not reloadable) so the caller can distinguish
 * from a not-found row.
 *
 * A negative `amount` is a redemption and a positive one a reload.
 * The two are not symmetric, so the statement is shaped per direction:
 * only a redemption stamps `last_used_date`, and only a reload may
 * touch a card already spent down to `USED` (and then only when the
 * card is `is_reloadable`, which is otherwise a field nothing honours).
 *
 * @param id The ID of the gift card
 * @param amount The amount to adjust (positive to add, negative to deduct)
 * @returns The updated gift card with new balance
 */
export async function updateBalance(id: number, amount: number): Promise<GiftCardJsonResponse | undefined> {
  if (!Number.isFinite(amount))
    throw new Error(`Gift card balance adjustment must be a finite number, got ${amount}`)

  // Rendered through `sqlHelpers` rather than hardcoded: Postgres numbers its
  // placeholders (`$1`) instead of accepting `?`, and its `is_active` is a real
  // BOOLEAN, so `= 1` is `operator does not exist: boolean = integer` there.
  // Both were literals here, which meant every gift card redemption threw on
  // Postgres while passing on SQLite - the dialect the tests run against.
  const dialect = sqlHelpers(env.DB_CONNECTION || 'sqlite')
  const p = dialect.param
  const now = formatDate(new Date())

  const isRedemption = amount < 0
  const isReload = amount > 0

  // A reload is the only direction that may revive a spent card, so the status
  // predicate differs by direction rather than being widened for both. The
  // branch is decided here rather than in SQL because a bound parameter
  // compared against a literal (`WHERE ? < 0`) leaves Postgres to infer the
  // parameter's type, and it infers integer - which rejects a fractional
  // adjustment against a REAL balance.
  const statusPredicate = isReload
    ? `(status = 'ACTIVE' OR (status = 'USED' AND is_reloadable = ${dialect.boolTrue}))`
    : `status = 'ACTIVE'`

  // Single atomic UPDATE - the arithmetic happens server-side via
  // `current_balance + ?`, and the `>= 0` predicate stops over-spend.
  // The new status flips to USED when the resulting balance is 0,
  // computed inline via CASE so the status update is part of the
  // same statement.
  //
  // Issued via `db.unsafe` with bound parameters: the fluent update
  // builder binds every `.set()` value (raw expressions arrive as
  // unbindable objects) and silently drops where-callbacks, which
  // would lose the over-spend guard entirely.
  // Placeholders are bound in template order: `bind` pushes the value and
  // returns the placeholder for its position, so the SQL and the value array
  // cannot drift apart when the statement changes shape by direction.
  const values: unknown[] = []
  const bind = (value: unknown): string => {
    values.push(value)
    return p(values.length)
  }

  const statement = await db.unsafe(
    `UPDATE gift_cards
    SET current_balance = current_balance + ${bind(amount)},
        ${isRedemption ? `last_used_date = ${bind(now)},\n        ` : ''}status = CASE WHEN current_balance + ${bind(amount)} = 0 THEN 'USED' ELSE 'ACTIVE' END,
        updated_at = ${bind(now)}
    WHERE id = ${bind(id)}
      AND is_active = ${dialect.boolTrue}
      AND ${statusPredicate}
      AND (expiry_date IS NULL OR expiry_date >= ${bind(now)})
      AND current_balance + ${bind(amount)} >= 0`,
    values,
  )
  // `db.unsafe(...)` is already awaited above, so `.execute` cannot be on the
  // result: the ternary that used to be here always took its else branch. What
  // a write statement resolves to is a driver result carrying an affected-row
  // count, which `UnsafeReturn` does not describe - it is declared as the rows
  // a SELECT returns. Narrowed to what is actually read, at the boundary where
  // the declared type and the driver disagree.
  const result = statement as unknown as DbWriteResult

  const affected = Number(result?.changes ?? result?.numUpdatedRows ?? result?.affectedRows ?? 0)
  if (affected > 0) {
    return await fetchById(id)
  }

  // UPDATE matched zero rows - diagnose for a useful error.
  const existing = await fetchById(id)
  if (!existing) throw new Error(`Gift card with ID ${id} not found`)
  const row = existing as Record<string, unknown>
  if (!row.is_active && !row.isActive)
    throw new Error(`Gift card is not active`)
  if (existing.status === 'USED' && isReload && !(row.is_reloadable ?? row.isReloadable))
    throw new Error(`Gift card is not reloadable`)
  if (existing.status !== 'ACTIVE')
    throw new Error(`Gift card is not active`)
  const expiry = (row.expiry_date ?? row.expiryDate) as string | null | undefined
  if (expiry && String(expiry) < now)
    throw new Error(`Gift card has expired`)
  // Fell through every other check - must be insufficient balance.
  throw new Error(`Insufficient gift card balance`)
}
