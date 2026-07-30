// Import dependencies
type LicenseKeyJsonResponse = ModelRow<typeof LicenseKey>
type NewLicenseKey = NewModelData<typeof LicenseKey>
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'
import { mutationCount } from '../../utils/mutation-count'
import { licenseKeyWriteData } from '../write-data'

/**
 * Create a new license key
 *
 * @param data The license key data to store
 * @returns The newly created license key record
 */
export async function store(data: NewLicenseKey): Promise<LicenseKeyJsonResponse> {
  try {
    const uuid = randomUUIDv7()
    const licenseData = {
      ...licenseKeyWriteData(data as Record<string, unknown>),
      uuid,
    }

    await db
      .insertInto('license_keys')
      .values(licenseData)
      .executeTakeFirst()

    const licenseKey = await db
      .selectFrom('license_keys')
      .where('uuid', '=', uuid)
      .selectAll()
      .executeTakeFirst()
    if (!licenseKey)
      throw new Error('Failed to resolve created license key')

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
      ...licenseKeyWriteData(item as Record<string, unknown>),
      uuid: randomUUIDv7(),
    }))

    const result = await db
      .insertInto('license_keys')
      .values(licenseDataArray)
      .executeTakeFirst()

    return mutationCount(result)
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create license keys in bulk: ${error.message}`)
    }

    throw error
  }
}
