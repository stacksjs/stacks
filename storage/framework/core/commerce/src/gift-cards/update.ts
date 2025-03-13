import type { GiftCardRequestType } from '@stacksjs/orm'
import type { GiftCardJsonResponse } from '../../../../orm/src/models/GiftCard'
import { db } from '@stacksjs/database'
import { fetchById } from './fetch'

/**
 * Update a gift card by ID
 *
 * @param id The ID of the gift card to update
 * @param request The updated gift card data
 * @returns The updated gift card record
 */
export async function update(id: number, request: GiftCardRequestType): Promise<GiftCardJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  // Check if gift card exists
  const existingGiftCard = await fetchById(id)
  if (!existingGiftCard) {
    throw new Error(`Gift card with ID ${id} not found`)
  }

  // Create update data object using request fields
  const updateData: Record<string, any> = {
    code: request.get('code'),
    initial_balance: request.get<number>('initial_balance'),
    current_balance: request.get<number>('current_balance'),
    currency: request.get('currency'),
    status: request.get('status'),
    user_id: request.get<number>('user_id'),
    purchaser_id: request.get('purchaser_id'),
    recipient_email: request.get('recipient_email'),
    recipient_name: request.get('recipient_name'),
    personal_message: request.get('personal_message'),
    is_digital: request.get<boolean>('is_digital'),
    is_reloadable: request.get<boolean>('is_reloadable'),
    is_active: request.get<boolean>('is_active'),
    expiry_date: request.get('expiry_date'),
    last_used_date: request.get('last_used_date'),
    template_id: request.get('template_id'),
    updated_at: new Date(),
  }

  // Remove undefined fields to avoid overwriting with null values
  Object.keys(updateData).forEach((key) => {
    if (updateData[key] === undefined) {
      delete updateData[key]
    }
  })

  // If no fields to update, just return the existing gift card
  if (Object.keys(updateData).length === 0) {
    return existingGiftCard
  }

  try {
    // Update the gift card
    await db
      .updateTable('gift_cards')
      .set(updateData)
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
 * Update a gift card's balance
 *
 * @param id The ID of the gift card
 * @param amount The amount to adjust (positive to add, negative to deduct)
 * @returns The updated gift card with new balance
 */
export async function updateBalance(id: number, amount: number): Promise<GiftCardJsonResponse | undefined> {
  // Check if gift card exists and is active
  const giftCard = await fetchById(id)

  if (!giftCard) {
    throw new Error(`Gift card with ID ${id} not found`)
  }

  if (!giftCard.is_active || giftCard.status !== 'ACTIVE') {
    throw new Error(`Gift card is not active`)
  }

  // Calculate new balance
  const newBalance = giftCard.current_balance + amount

  // Make sure balance doesn't go below zero
  if (newBalance < 0) {
    throw new Error(`Insufficient gift card balance`)
  }

  try {
    // Update the gift card balance
    await db
      .updateTable('gift_cards')
      .set({
        current_balance: newBalance,
        last_used_date: new Date().toISOString(),
        status: newBalance === 0 ? 'USED' : 'ACTIVE',
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .execute()

    // Fetch the updated gift card
    return await fetchById(id)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to update gift card balance: ${error.message}`)
    }

    throw error
  }
}
