import type { NewTaxRate, TaxRateJsonResponse, TaxRateRequestType } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new tax rate
 *
 * @param request Tax rate data to store
 * @returns The newly created tax rate record
 */
export async function store(request: TaxRateRequestType): Promise<TaxRateJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  try {
    // Prepare tax rate data
    const taxData: NewTaxRate = {
      name: request.get('name'),
      rate: request.get('rate'),
      type: request.get('type'),
      country: request.get('country'),
      region: request.get('region'),
      status: request.get('status'),
      is_default: request.get('is_default'),
    }

    taxData.uuid = randomUUIDv7()

    // Insert the tax rate
    const result = await db
      .insertInto('tax_rates')
      .values(taxData)
      .executeTakeFirst()

    const taxId = Number(result.insertId) || Number(result.numInsertedOrUpdatedRows)

    // Retrieve the newly created tax rate
    const taxRate = await db
      .selectFrom('tax_rates')
      .where('id', '=', taxId)
      .selectAll()
      .executeTakeFirst()

    return taxRate
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create tax rate: ${error.message}`)
    }

    throw error
  }
}

/**
 * Create multiple tax rates at once
 *
 * @param requests Array of tax rate data to store
 * @returns Number of tax rates created
 */
export async function bulkStore(requests: TaxRateRequestType[]): Promise<number> {
  if (!requests.length)
    return 0

  let createdCount = 0

  try {
    // Process each tax rate
    await db.transaction().execute(async (trx) => {
      for (const request of requests) {
        // Validate request data
        request.validate()

        // Prepare tax rate data
        const taxData: NewTaxRate = {
          name: request.get('name'),
          rate: request.get('rate'),
          type: request.get('type'),
          country: request.get('country'),
          region: request.get('region'),
          status: request.get('status'),
          is_default: request.get('is_default'),
        }

        taxData.uuid = randomUUIDv7()

        // Insert the tax rate
        await trx
          .insertInto('tax_rates')
          .values(taxData)
          .execute()

        createdCount++
      }
    })

    return createdCount
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create tax rates in bulk: ${error.message}`)
    }

    throw error
  }
}
