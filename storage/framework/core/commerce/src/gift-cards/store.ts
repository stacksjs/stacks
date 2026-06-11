type GiftCardJsonResponse = ModelRow<typeof GiftCard>
type NewGiftCard = NewModelData<typeof GiftCard>
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { HttpError } from '@stacksjs/error-handling'
import { isUniqueViolation } from '@stacksjs/orm'

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

    const insertId = Number(createdGiftCard.insertId) || Number(createdGiftCard.numInsertedOrUpdatedRows)

    // If insert was successful, retrieve the newly created gift card
    if (insertId) {
      const giftCard = await db
        .selectFrom('gift_cards')
        .where('id', '=', insertId)
        .selectAll()
        .executeTakeFirst()

      return giftCard as GiftCardJsonResponse
    }

    return undefined
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
