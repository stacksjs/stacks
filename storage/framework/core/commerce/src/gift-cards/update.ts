import type { GiftCard, ModelRow, UpdateModelData } from '@stacksjs/orm'
import { db, mutationCount, parseSqlDateTime, sqlHelpers } from '@stacksjs/database/runtime'
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
  // `status` is assigned FIRST because MySQL evaluates SET assignments left to
  // right against values already updated: after the balance, its CASE saw the
  // new balance, so a card spent to exactly 0 stayed ACTIVE. PostgreSQL and
  // SQLite read the old row whatever the order.
  //
  // The never-taken `WHEN 1 = 0 THEN status` branch types the CASE. A CASE of
  // bare literals is text, and PostgreSQL will not assign text to the enum
  // type `status` is there, so every balance change threw. With one branch
  // typed as the column, PostgreSQL resolves the literals to that type, without
  // this code having to name it.
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
    SET status = CASE WHEN current_balance + ${bind(amount)} = 0 THEN 'USED' WHEN 1 = 0 THEN status ELSE 'ACTIVE' END,
        current_balance = current_balance + ${bind(amount)},
        ${isRedemption ? `last_used_date = ${bind(now)},\n        ` : ''}updated_at = ${bind(now)}
    WHERE id = ${bind(id)}
      AND is_active = ${dialect.boolTrue}
      AND ${statusPredicate}
      AND (expiry_date IS NULL OR expiry_date >= ${bind(now)})
      AND current_balance + ${bind(amount)} >= 0`,
    values,
  )
  // A write resolves to the driver's result, not the rows `db.unsafe` is
  // declared to return. PostgreSQL carries the count in `count`, which the
  // reader here used to miss, so a committed change was diagnosed as a failure.
  if (mutationCount(statement) > 0) {
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
  // Compared as instants, not strings. PostgreSQL and MySQL return the column
  // as a Date, and `String(date)` - "Wed Jan 01 2020 ..." - starts with a
  // letter, which sorts after every digit of `now`, so an expired card was
  // never detected there: a redemption was diagnosed as an insufficient
  // balance, and a zero adjustment fell through to the success below.
  const expiry = parseSqlDateTime(row.expiry_date ?? row.expiryDate)
  const checkedAt = parseSqlDateTime(now)
  if (expiry && checkedAt && expiry.getTime() < checkedAt.getTime())
    throw new Error(`Gift card has expired`)
  // Every guard the re-read can see held. For any non-zero amount that means
  // the one it cannot - the balance at write time - failed: a non-zero
  // adjustment always changes current_balance, so it cannot match the card and
  // leave it unchanged.
  //
  // Zero can. It writes values the card already holds once `updated_at` is in
  // the same second, and MySQL counts rows CHANGED, so it reported zero rows
  // for an UPDATE that matched, and this used to call it an insufficient
  // balance (stacksjs/stacks#2639). Only zero is accepted here: a non-zero
  // amount whose guard failed may pass on this re-read if a concurrent reload
  // landed in between, and accepting it would report a redemption that never
  // took the money.
  if (amount === 0 && Number(row.current_balance ?? row.currentBalance) >= 0)
    return existing

  throw new Error(`Insufficient gift card balance`)
}
