import type { ManufacturerJsonResponse, NewManufacturer } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new product manufacturer
 *
 * @param data The manufacturer data to store
 * @returns The newly created manufacturer record
 */
export async function store(data: NewManufacturer): Promise<ManufacturerJsonResponse> {
  try {
    const manufacturerData = {
      ...data,
      uuid: randomUUIDv7(),
      featured: data.featured ?? false,
    }

    const result = await db
      .insertInto('manufacturers')
      .values(manufacturerData)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create manufacturer')

    return result
  }
  catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Duplicate entry')) {
        throw new Error('A manufacturer with this name already exists')
      }

      throw new Error(`Failed to create manufacturer: ${error.message}`)
    }

    throw error
  }
}

/**
 * Create multiple manufacturers at once
 *
 * @param data Array of manufacturer data to store
 * @returns Number of manufacturers created
 */
export async function bulkStore(data: NewManufacturer[]): Promise<number> {
  if (!data.length)
    return 0

  let createdCount = 0

  try {
    await db.transaction().execute(async (trx) => {
      for (const manufacturer of data) {
        const manufacturerData = {
          ...manufacturer,
          uuid: randomUUIDv7(),
          featured: manufacturer.featured ?? false,
        }

        await trx
          .insertInto('manufacturers')
          .values(manufacturerData)
          .execute()

        createdCount++
      }
    })

    return createdCount
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create manufacturers in bulk: ${error.message}`)
    }

    throw error
  }
}
