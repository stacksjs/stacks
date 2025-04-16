import type { GiftCardJsonResponse, NewGiftCard } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new gift card
 *
 * @param data The gift card data to store
 * @returns The newly created gift card record
 */
export async function store(data: NewGiftCard): Promise<GiftCardJsonResponse | undefined> {
  const giftCardData: NewGiftCard = {
    ...data,
    current_balance: data.initial_balance, // Initially set to same as initial balance
    status: data.status || 'ACTIVE',
    is_active: data.is_active ?? true,
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

      return giftCard
    }

    return undefined
  }
  catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Duplicate entry') && error.message.includes('code')) {
        throw new Error('A gift card with this code already exists')
      }

      throw new Error(`Failed to create gift card: ${error.message}`)
    }

    throw error
  }
}
