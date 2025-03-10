import type { ManufacturerRequestType } from '@stacksjs/orm'
import type { ManufacturerJsonResponse, NewManufacturer } from '../../../../orm/src/models/Manufacturer'
import { db } from '@stacksjs/database'

/**
 * Create a new product manufacturer
 *
 * @param request The manufacturer data to store
 * @returns The newly created manufacturer record
 */
export async function store(request: ManufacturerRequestType): Promise<ManufacturerJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  const manufacturerData: NewManufacturer = {
    manufacturer: request.get<string>('manufacturer'),
    description: request.get<string>('description'),
    country: request.get<string>('country'),
    featured: request.get<boolean>('featured') || false,
  }

  try {
    // Insert the manufacturer record
    const createdManufacturer = await db
      .insertInto('manufacturers')
      .values(manufacturerData)
      .executeTakeFirst()

    // If insert was successful, retrieve the newly created manufacturer
    if (createdManufacturer.insertId) {
      const manufacturer = await db
        .selectFrom('manufacturers')
        .where('id', '=', Number(createdManufacturer.insertId))
        .selectAll()
        .executeTakeFirst()

      return manufacturer
    }

    return undefined
  }
  catch (error) {
    if (error instanceof Error) {
      // Check for duplicate entries if you have unique constraints
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
 * @param requests Array of manufacturer data to store
 * @returns Number of manufacturers created
 */
export async function bulkStore(requests: ManufacturerRequestType[]): Promise<number> {
  if (!requests.length)
    return 0

  let createdCount = 0

  try {
    // Process each manufacturer
    await db.transaction().execute(async (trx) => {
      for (const request of requests) {
        // Validate request data
        await request.validate()

        // Prepare manufacturer data
        const manufacturerData: NewManufacturer = {
          manufacturer: request.get<string>('manufacturer'),
          description: request.get<string>('description'),
          country: request.get<string>('country'),
          featured: request.get<boolean>('featured') || false,
        }

        await trx
          .insertInto('manufacturers')
          .values(manufacturerData)
          .executeTakeFirst()

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
