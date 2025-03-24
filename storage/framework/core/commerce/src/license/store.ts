// Import dependencies
import type { LicenseKeyRequestType } from '@stacksjs/orm'
import type { LicenseKeyJsonResponse, NewLicenseKey } from '../../../../orm/src/models/LicenseKey'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new license key
 *
 * @param request License key data to store
 * @returns The newly created license key record
 */
export async function store(request: LicenseKeyRequestType): Promise<LicenseKeyJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  try {
    // Prepare license key data
    const licenseData: NewLicenseKey = {
      key: request.get('key'),
      status: request.get('status'),
      expiry_date: request.get('expiry_date'),
      template: request.get('template'),
      customer_id: request.get<number>('customer_id'),
      product_id: request.get<number>('product_id'),
      order_id: request.get<number>('order_id'),
    }

    // Insert the license key
    const result = await db
      .insertInto('license_keys')
      .values(licenseData)
      .executeTakeFirst()

    const licenseId = Number(result.insertId) || Number(result.numInsertedOrUpdatedRows)

    // Retrieve the newly created license key
    const licenseKey = await db
      .selectFrom('license_keys')
      .where('id', '=', licenseId)
      .selectAll()
      .executeTakeFirst()

    return licenseKey
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create license key: ${error.message}`)
    }

    throw error
  }
}

/**
 * Create multiple license keys at once
 *
 * @param requests Array of license key data to store
 * @returns Number of license keys created
 */
export async function bulkStore(requests: LicenseKeyRequestType[]): Promise<number> {
  if (!requests.length)
    return 0

  let createdCount = 0

  try {
    // Process each license key
    await db.transaction().execute(async (trx) => {
      for (const request of requests) {
        // Validate request data
        request.validate()

        // Prepare license key data
        const licenseData: NewLicenseKey = {
          key: request.get('key'),
          status: request.get('status'),
          expiry_date: request.get('expiry_date'),
          template: request.get('template'),
          customer_id: request.get<number>('customer_id'),
          product_id: request.get<number>('product_id'),
          order_id: request.get<number>('order_id'),
          uuid: randomUUIDv7(),
        }

        // Insert the license key
        await trx
          .insertInto('license_keys')
          .values(licenseData)
          .execute()

        createdCount++
      }
    })

    return createdCount
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create license keys in bulk: ${error.message}`)
    }

    throw error
  }
}
