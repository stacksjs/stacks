type WaitlistProductJsonResponse = ModelRow<typeof WaitlistProduct>
type NewWaitlistProduct = NewModelData<typeof WaitlistProduct>
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { mutationCount } from '../../utils/mutation-count'
import { productWaitlistWriteData } from './write-data'

/**
 * Create a new waitlist product entry
 *
 * @param data Waitlist product data to store
 * @returns The newly created waitlist product record
 */
export async function store(data: NewWaitlistProduct): Promise<WaitlistProductJsonResponse> {
  try {
    const uuid = randomUUIDv7()
    const waitlistData = {
      ...productWaitlistWriteData(data as Record<string, unknown>),
      uuid,
      status: data.status || 'waiting',
    }

    await db
      .insertInto('waitlist_products')
      .values(waitlistData)
      .executeTakeFirst()

    const result = await db
      .selectFrom('waitlist_products')
      .where('uuid', '=', uuid)
      .selectAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create waitlist product')

    return result as WaitlistProductJsonResponse
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create waitlist product: ${error.message}`)
    }

    throw error
  }
}

/**
 * Create multiple waitlist product entries at once
 *
 * @param data Array of waitlist product data to store
 * @returns Number of waitlist products created
 */
export async function bulkStore(data: NewWaitlistProduct[]): Promise<number> {
  if (!data.length)
    return 0

  try {
    const waitlistDataArray = data.map(item => ({
      ...productWaitlistWriteData(item as Record<string, unknown>),
      status: item.status || 'waiting',
      uuid: randomUUIDv7(),
    }))

    const result = await db
      .insertInto('waitlist_products')
      .values(waitlistDataArray)
      .executeTakeFirst()

    return mutationCount(result)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create waitlist products in bulk: ${error.message}`)
    }

    throw error
  }
}
