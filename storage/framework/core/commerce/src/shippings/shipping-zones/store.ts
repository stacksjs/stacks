import type { ModelRow, NewModelData, ShippingZone } from '@stacksjs/orm'
// Import dependencies
type ShippingZoneJsonResponse = ModelRow<typeof ShippingZone>
type NewShippingZone = NewModelData<typeof ShippingZone>
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { asModelRow } from '../../utils/model-row'
import { mutationCount } from '../../utils/mutation-count'
import { shippingZoneWriteData } from '../write-data'

/**
 * Create a new shipping zone
 *
 * @param data The shipping zone data to store
 * @returns The newly created shipping zone record
 */
export async function store(data: NewShippingZone): Promise<ShippingZoneJsonResponse> {
  try {
    const uuid = randomUUIDv7()
    const zoneData = {
      ...shippingZoneWriteData(data as Record<string, unknown>),
      uuid,
    }

    await db
      .insertInto('shipping_zones')
      .values(zoneData)
      .executeTakeFirst()

    const model = await db
      .selectFrom('shipping_zones')
      .where('uuid', '=', uuid)
      .selectAll()
      .executeTakeFirst()
    if (!model)
      throw new Error('Failed to resolve created shipping zone')
    return asModelRow<ShippingZoneJsonResponse>(model)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create shipping zone: ${error.message}`)
    }

    throw error
  }
}

/**
 * Create multiple shipping zones at once
 *
 * @param data Array of shipping zone data to store
 * @returns Number of shipping zones created
 */
export async function bulkStore(data: NewShippingZone[]): Promise<number> {
  if (!data.length)
    return 0

  try {
    const zoneDataArray = data.map(item => ({
      ...shippingZoneWriteData(item as Record<string, unknown>),
      uuid: randomUUIDv7(),
    }))

    const result = await db
      .insertInto('shipping_zones')
      .values(zoneDataArray)
      .executeTakeFirst()

    return mutationCount(result)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create shipping zones in bulk: ${error.message}`)
    }

    throw error
  }
}
