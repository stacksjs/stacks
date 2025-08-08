import type { GiftCardJsonResponse, GiftCardUpdate } from '@stacksjs/orm'
import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
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
        last_used_date: formatDate(new Date()),
        status: newBalance === 0 ? 'USED' : 'ACTIVE',
        updated_at: formatDate(new Date()),
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
