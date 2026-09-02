import type { ModelRow, TaxRate } from '@stacksjs/orm'
type TaxRateJsonResponse = ModelRow<typeof TaxRate>
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { asModelRow } from '../utils/model-row'
import type { TaxRateWriteData } from './types'

/**
 * Create a new tax rate
 *
 * @param data Tax rate data to store
 * @returns The newly created tax rate record
 */
export async function store(data: TaxRateWriteData): Promise<TaxRateJsonResponse> {
  try {
    return await db.transaction(async (trx: any) => {
      const taxData = {
        ...data,
        uuid: randomUUIDv7(),
      }

      if (taxData.is_default) {
        await trx
          .updateTable('tax_rates')
          .set({ is_default: false })
          .execute()
      }

      const result = await trx
        .insertInto('tax_rates')
        .values(taxData)
        .returningAll()
        .executeTakeFirst()

      if (!result)
        throw new Error('Failed to create tax rate')

      return asModelRow<TaxRateJsonResponse>(result)
    })
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
export async function bulkStore(data: TaxRateWriteData[]): Promise<number> {
  if (!data.length)
    return 0

  try {
    return await db.transaction(async (trx: any) => {
      let createdCount = 0
      for (const item of data) {
        const taxData = {
          ...item,
          uuid: randomUUIDv7(),
        }

        if (taxData.is_default) {
          await trx
            .updateTable('tax_rates')
            .set({ is_default: false })
            .execute()
        }

        const result = await trx
          .insertInto('tax_rates')
          .values(taxData)
          .executeTakeFirst()

        if (result)
          createdCount++
      }

      return createdCount
    })
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create tax rates in bulk: ${error.message}`)
    }

    throw error
  }
}
