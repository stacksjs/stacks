import type { GiftCardRequestType } from '@stacksjs/orm'
import type { GiftCardJsonResponse, NewGiftCard } from '../../../../orm/src/models/GiftCard'
import { db } from '@stacksjs/database'

/**
 * Create a new gift card
 *
 * @param request The gift card data to store
 * @returns The newly created gift card record
 */
export async function store(request: GiftCardRequestType): Promise<GiftCardJsonResponse | undefined> {
  await request.validate()

  const giftCardData: NewGiftCard = {
    code: request.get('code'),
    initial_balance: request.get<number>('initial_balance'),
    current_balance: request.get<number>('initial_balance'), // Initially set to same as initial balance
    currency: request.get('currency'),
    status: request.get('status') || 'ACTIVE',
    user_id: request.get<number>('user_id'),
    purchaser_id: request.get('purchaser_id'),
    recipient_email: request.get('recipient_email'),
    recipient_name: request.get('recipient_name'),
    personal_message: request.get('personal_message'),
    is_digital: request.get<boolean>('is_digital'),
    is_reloadable: request.get<boolean>('is_reloadable'),
    is_active: request.get<boolean>('is_active') ?? true,
    expiry_date: request.get('expiry_date'),
    template_id: request.get('template_id'),
  }

  try {
    // Insert the gift card record
    const createdGiftCard = await db
      .insertInto('gift_cards')
      .values(giftCardData)
      .executeTakeFirst()

    // If insert was successful, retrieve the newly created gift card
    if (createdGiftCard.insertId) {
      const giftCard = await db
        .selectFrom('gift_cards')
        .where('id', '=', Number(createdGiftCard.insertId))
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
