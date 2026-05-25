import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
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
  if (!existingGiftCard) {
    throw new Error(`Gift card with ID ${id} not found`)
  }

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
    if (error instanceof Error) {
      // Handle duplicate code error
      if (error.message.includes('Duplicate entry') && error.message.includes('code')) {
        throw new Error('A gift card with this code already exists')
      }

      throw new Error(`Failed to update gift card: ${error.message}`)
    }

    throw error
  }
}

/**
 * Update a gift card's balance atomically (stacksjs/stacks#1879 Co-8).
 *
 * Pre-fix: read balance → compute new → write. Two parallel $50
 * redemptions of a $100 card both saw `current_balance = 100`,
 * both wrote `50`, leaving `50` instead of `0`. The post-read
 * negative-balance guard only caught single-threaded misuse.
 *
 * Post-fix: single conditional UPDATE that does the arithmetic and
 * enforces every precondition in the WHERE clause. The database
 * guarantees only one writer wins the race. Throws when the row
 * was found but the precondition failed (insufficient balance,
 * inactive, missing) so the caller can distinguish from a
 * not-found row.
 *
 * @param id The ID of the gift card
 * @param amount The amount to adjust (positive to add, negative to deduct)
 * @returns The updated gift card with new balance
 */
export async function updateBalance(id: number, amount: number): Promise<GiftCardJsonResponse | undefined> {
  const now = formatDate(new Date())

  // Single atomic UPDATE — the arithmetic happens server-side via
  // `current_balance + ?`, and the `>= 0` predicate stops over-spend.
  // The new status flips to USED when the resulting balance is 0,
  // computed inline via CASE so the status update is part of the
  // same statement.
  const result = await db
    .updateTable('gift_cards')
    .set({
      current_balance: (db as any).raw(`current_balance + ${amount}`),
      last_used_date: now,
      status: (db as any).raw(`CASE WHEN current_balance + ${amount} = 0 THEN 'USED' ELSE 'ACTIVE' END`),
      updated_at: now,
    })
    .where('id', '=', id)
    .where('is_active', '=', 1)
    .where('status', '=', 'ACTIVE')
    .where((eb: any) => eb.cmpr(eb.raw(`current_balance + ${amount}`), '>=', 0))
    .executeTakeFirst()

  const affected = Number((result as any)?.numUpdatedRows ?? (result as any)?.affectedRows ?? 0)
  if (affected > 0) {
    return await fetchById(id)
  }

  // UPDATE matched zero rows — diagnose for a useful error.
  const existing = await fetchById(id)
  if (!existing) throw new Error(`Gift card with ID ${id} not found`)
  if (!(existing as Record<string, unknown>).is_active || existing.status !== 'ACTIVE')
    throw new Error(`Gift card is not active`)
  // Fell through every other check — must be insufficient balance.
  throw new Error(`Insufficient gift card balance`)
}
