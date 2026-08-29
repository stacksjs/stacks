import type { Courier, ModelRow, NewModelData } from '@stacksjs/orm'
type CourierJsonResponse = ModelRow<typeof Courier>
type NewCourier = NewModelData<typeof Courier>
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { mutationCount } from '../../utils/mutation-count'
import { courierWriteData } from '../write-data'

/**
 * Create a new courier
 *
 * @param data The courier data to store
 * @returns The newly created courier record
 */
export async function store(data: NewCourier): Promise<CourierJsonResponse> {
  try {
    const uuid = randomUUIDv7()
    const courierData = {
      ...courierWriteData(data as Record<string, unknown>),
      uuid,
    }

    await db
      .insertInto('couriers')
      .values(courierData)
      .executeTakeFirst()

    const result = await db
      .selectFrom('couriers')
      .where('uuid', '=', uuid)
      .selectAll()
      .executeTakeFirst()
    if (!result)
      throw new Error('Failed to resolve created courier')

    return result as CourierJsonResponse
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create courier: ${error.message}`)
    }

    throw error
  }
}

/**
 * Create multiple couriers at once
 *
 * @param data Array of courier data to store
 * @returns Number of couriers created
 */
export async function bulkStore(data: NewCourier[]): Promise<number> {
  if (!data.length)
    return 0

  try {
    const courierDataArray = data.map(item => ({
      ...courierWriteData(item as Record<string, unknown>),
      uuid: randomUUIDv7(),
    }))

    const result = await db
      .insertInto('couriers')
      .values(courierDataArray)
      .executeTakeFirst()

    return mutationCount(result)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create couriers in bulk: ${error.message}`)
    }

    throw error
  }
}
