type DriverJsonResponse = ModelRow<typeof Driver>
type NewDriver = NewModelData<typeof Driver>
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { mutationCount } from '../../utils/mutation-count'
import { driverWriteData } from '../write-data'

/**
 * Create a new driver
 *
 * @param data The driver data to store
 * @returns The newly created driver record
 */
export async function store(data: NewDriver): Promise<DriverJsonResponse> {
  try {
    const uuid = randomUUIDv7()
    const driverData = {
      ...driverWriteData(data as Record<string, unknown>),
      uuid,
    }

    await db
      .insertInto('drivers')
      .values(driverData)
      .executeTakeFirst()

    const result = await db
      .selectFrom('drivers')
      .where('uuid', '=', uuid)
      .selectAll()
      .executeTakeFirst()
    if (!result)
      throw new Error('Failed to resolve created driver')

    return result as DriverJsonResponse
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create driver: ${error.message}`)
    }

    throw error
  }
}

/**
 * Create multiple drivers at once
 *
 * @param data Array of driver data to store
 * @returns Number of drivers created
 */
export async function bulkStore(data: NewDriver[]): Promise<number> {
  if (!data.length)
    return 0

  try {
    const driverDataArray = data.map(item => ({
      ...driverWriteData(item as Record<string, unknown>),
      uuid: randomUUIDv7(),
    }))

    const result = await db
      .insertInto('drivers')
      .values(driverDataArray)
      .executeTakeFirst()

    return mutationCount(result)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create drivers in bulk: ${error.message}`)
    }

    throw error
  }
}
