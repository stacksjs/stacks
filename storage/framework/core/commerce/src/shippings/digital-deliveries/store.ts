import type { DigitalDelivery, ModelRow, NewModelData } from '@stacksjs/orm'
type DigitalDeliveryJsonResponse = ModelRow<typeof DigitalDelivery>
type NewDigitalDelivery = NewModelData<typeof DigitalDelivery>
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { mutationCount } from '../../utils/mutation-count'
import { digitalDeliveryWriteData } from '../write-data'

/**
 * Create a new digital delivery
 *
 * @param data The digital delivery data to store
 * @returns The newly created digital delivery record
 */
export async function store(data: NewDigitalDelivery): Promise<DigitalDeliveryJsonResponse> {
  try {
    const uuid = randomUUIDv7()
    const deliveryData = {
      ...digitalDeliveryWriteData(data as Record<string, unknown>),
      uuid,
    }

    await db
      .insertInto('digital_deliveries')
      .values(deliveryData)
      .executeTakeFirst()

    const digitalDelivery = await db
      .selectFrom('digital_deliveries')
      .where('uuid', '=', uuid)
      .selectAll()
      .executeTakeFirst()
    if (!digitalDelivery)
      throw new Error('Failed to resolve created digital delivery')

    return digitalDelivery
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create digital delivery: ${error.message}`)
    }

    throw error
  }
}

/**
 * Create multiple digital deliveries at once
 *
 * @param data Array of digital delivery data to store
 * @returns Number of digital deliveries created
 */
export async function bulkStore(data: NewDigitalDelivery[]): Promise<number> {
  if (!data.length)
    return 0

  try {
    const deliveryDataArray = data.map(item => ({
      ...digitalDeliveryWriteData(item as Record<string, unknown>),
      uuid: randomUUIDv7(),
    }))

    const result = await db
      .insertInto('digital_deliveries')
      .values(deliveryDataArray)
      .executeTakeFirst()

    return mutationCount(result)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create digital deliveries in bulk: ${error.message}`)
    }

    throw error
  }
}
