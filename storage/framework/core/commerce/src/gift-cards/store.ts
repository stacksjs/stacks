import type { GiftCard, ModelRow, NewModelData } from '@stacksjs/orm'
type GiftCardJsonResponse = ModelRow<typeof GiftCard>
type NewGiftCard = NewModelData<typeof GiftCard>
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { asModelRow } from '../utils/model-row'
import { HttpError } from '@stacksjs/error-handling'
import { isUniqueViolation } from '@stacksjs/orm'
import { insertedId } from '../utils/inserted-id'

/**
 * Create a new gift card
 *
 * @param data The gift card data to store
 * @returns The newly created gift card record
 */
export async function store(data: NewGiftCard): Promise<GiftCardJsonResponse | undefined> {
  const d = data as Record<string, unknown>
  const giftCardData = {
    ...data,
    current_balance: d.current_balance ?? d.initial_balance,
    status: data.status || 'ACTIVE',
    is_active: d.is_active ?? true,
    uuid: randomUUIDv7(),
  }

  try {
    // Insert the gift card record
    const createdGiftCard = await db
      .insertInto('gift_cards')
      .values(giftCardData)
      .executeTakeFirst()

    /*
     * An insert answers a row or nothing, and this read it blind. A driver that
     * returns no row - or a statement that inserted nothing - threw a
     * `TypeError` here rather than reporting a failed insert.
     */
    // Read the id the driver reported, never a row count. This used to fall
    // back to `numInsertedOrUpdatedRows`, which SQLite does not report at all -
    // so `store()` returned undefined for every successful insert on the
    // framework's default dialect, and on a driver that did report the count it
    // would have fetched row 1 instead of the new card.
    const id = insertedId(createdGiftCard)

    if (id !== undefined) {
      const giftCard = await db
        .selectFrom('gift_cards')
        .where('id', '=', id)
        .selectAll()
        .executeTakeFirst()

      return asModelRow<GiftCardJsonResponse>(giftCard)
    }

    // Postgres reports no insert id without a RETURNING clause, so fall back to
    // the uuid this row was written with - the same approach `payments/store`
    // already takes.
    const giftCard = await db
      .selectFrom('gift_cards')
      .where('uuid', '=', giftCardData.uuid)
      .selectAll()
      .executeTakeFirst()

    return asModelRow<GiftCardJsonResponse>(giftCard, true)
  }
  catch (error) {
    if (error instanceof HttpError)
      throw error
    // Cross-dialect duplicate detection (#1957).
    if (isUniqueViolation(error))
      throw new HttpError(409, 'A gift card with this code already exists')
    if (error instanceof Error)
      throw new Error(`Failed to create gift card: ${error.message}`)
    throw error
  }
}
