// Import dependencies
import type { LicenseKeyJsonResponse, NewLicenseKey } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { fetchById } from './fetch'

/**
 * Create a new license key
 *
 * @param data The license key data to store
 * @returns The newly created license key record
 */
export async function store(data: NewLicenseKey): Promise<LicenseKeyJsonResponse> {
  try {
    const licenseData = {
      ...data,
      uuid: randomUUIDv7(),
    }

    const result = await db
      .insertInto('license_keys')
      .values(licenseData)
      .executeTakeFirst()

    if (!result)
      throw new Error('Failed to create license key')

    const insertedId = Number(result.insertId) || Number(result.numInsertedOrUpdatedRows)

    const licenseKey = await fetchById(insertedId)

    if (!licenseKey)
      throw new Error('Failed to create license key')

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
 * @param data Array of license key data to store
 * @returns Number of license keys created
 */
export async function bulkStore(data: NewLicenseKey[]): Promise<number> {
  if (!data.length)
    return 0

  try {
    const licenseDataArray = data.map(item => ({
      ...item,
      uuid: randomUUIDv7(),
    }))

    const result = await db
      .insertInto('license_keys')
      .values(licenseDataArray)
      .executeTakeFirst()

    return Number(result.numInsertedOrUpdatedRows)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create license keys in bulk: ${error.message}`)
    }

    throw error
  }
}
