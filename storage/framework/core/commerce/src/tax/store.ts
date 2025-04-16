import type { NewTaxRate, TaxRateJsonResponse } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new tax rate
 *
 * @param data Tax rate data to store
 * @returns The newly created tax rate record
 */
export async function store(data: NewTaxRate): Promise<TaxRateJsonResponse> {
  try {
    const taxData = {
      ...data,
      uuid: randomUUIDv7(),
    }

    const result = await db
      .insertInto('tax_rates')
      .values(taxData)
      .returningAll()
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create tax rate')

    return result
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
 * @param data Array of tax rate data to store
 * @returns Number of tax rates created
 */
export async function bulkStore(data: NewTaxRate[]): Promise<number> {
  if (!data.length)
    return 0

  try {
    const taxDataArray = data.map(item => ({
      ...item,
      uuid: randomUUIDv7(),
    }))

    const result = await db
      .insertInto('tax_rates')
      .values(taxDataArray)
      .executeTakeFirst()

    return Number(result.numInsertedOrUpdatedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create tax rates in bulk: ${error.message}`)
    }

    throw error
  }
}
