import { db } from '@stacksjs/database'
import { formatDate } from '@stacksjs/orm'
import { fetchById } from './fetch'
import { mutationCount } from '../utils/mutation-count'

/**
 * Delete a gift card by ID
 * @param id The ID of the gift card to delete
 * @returns A boolean indicating whether the deletion was successful
 */
export async function destroy(id: number): Promise<boolean> {
  const result = await db
    .deleteFrom('gift_cards')
    .where('id', '=', id)
    .executeTakeFirst()

  return mutationCount(result) > 0
}

/**
 * Bulk delete multiple gift cards
 * @param ids Array of gift card IDs to delete
 * @returns Number of gift cards successfully deleted
 */
export async function bulkDestroy(ids: number[]): Promise<number> {
  if (!ids.length) {
    return 0
  }

  // Delete all gift cards in the array
  const result = await db
    .deleteFrom('gift_cards')
    .where('id', 'in', ids)
    .executeTakeFirst()

  return mutationCount(result)
}

/**
 * Delete expired gift cards
 * @returns Number of gift cards deleted
 */
export async function destroyExpired(): Promise<number> {
  // `expiry_date` is a timestamp (`YYYY-MM-DD HH:MM:SS`), so comparing it
  // against a date-only `YYYY-MM-DD` string left every card that expired
  // earlier the same day looking unexpired: the stored value is the longer
  // string and sorts after the truncated one. `formatDate` is the same
  // rendering the rest of the module writes and compares with.
  const now = formatDate(new Date())

  const result = await db
    .deleteFrom('gift_cards')
    .where('expiry_date', '<', now)
    .executeTakeFirst()

  return mutationCount(result)
}

/**
 * Deactivate a gift card (set is_active to false)
 * @param id The ID of the gift card to deactivate
 * @returns A boolean indicating whether the deactivation was successful
 */
export async function deactivate(id: number): Promise<boolean> {
  // First check if the gift card exists
  const giftCard = await fetchById(id)

  if (!giftCard) {
    throw new Error(`Gift card with ID ${id} not found`)
  }

  // Update the gift card status
  const result = await db
    .updateTable('gift_cards')
    .set({
      is_active: false,
      status: 'DEACTIVATED',
      updated_at: formatDate(new Date()),
    })
    .where('id', '=', id)
    .executeTakeFirst()

  // `executeTakeFirst()` resolves to a driver result object, which is truthy
  // whether it updated one row or none - so `!!result` reported success for a
  // deactivation that did nothing. `mutationCount` reads the affected-row count
  // the way `destroy` above it already does.
  return mutationCount(result) > 0
}
