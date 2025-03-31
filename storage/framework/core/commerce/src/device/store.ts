import type { NewPrintDevice, PrintDeviceJsonResponse, PrintDeviceRequestType } from '@stacksjs/orm'
import { randomUUIDv7 } from 'bun'
import { db } from '@stacksjs/database'

/**
 * Create a new print device
 *
 * @param request Print device data to store
 * @returns The newly created print device record
 */
export async function store(request: PrintDeviceRequestType): Promise<PrintDeviceJsonResponse | undefined> {
  // Validate the request data
  await request.validate()

  try {
    // Prepare print device data
    const deviceData: NewPrintDevice = {
      name: request.get('name'),
      mac_address: request.get('mac_address'),
      location: request.get('location'),
      terminal: request.get('terminal'),
      status: request.get('status'),
      last_ping: request.get('last_ping'),
      print_count: request.get('print_count'),
    }

    deviceData.uuid = randomUUIDv7()

    // Insert the print device
    const result = await db
      .insertInto('print_devices')
      .values(deviceData)
      .executeTakeFirst()

    const deviceId = Number(result.insertId) || Number(result.numInsertedOrUpdatedRows)

    // Retrieve the newly created print device
    const printDevice = await db
      .selectFrom('print_devices')
      .where('id', '=', deviceId)
      .selectAll()
      .executeTakeFirst()

    return printDevice
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create print device: ${error.message}`)
    }

    throw error
  }
}

/**
 * Create multiple print devices at once
 *
 * @param requests Array of print device data to store
 * @returns Number of print devices created
 */
export async function bulkStore(requests: PrintDeviceRequestType[]): Promise<number> {
  if (!requests.length)
    return 0

  let createdCount = 0

  try {
    // Process each print device
    await db.transaction().execute(async (trx) => {
      for (const request of requests) {
        // Validate request data
        request.validate()

        // Prepare print device data
        const deviceData: NewPrintDevice = {
          name: request.get('name'),
          mac_address: request.get('mac_address'),
          location: request.get('location'),
          terminal: request.get('terminal'),
          status: request.get('status'),
          last_ping: request.get('last_ping'),
          print_count: request.get('print_count'),
        }

        deviceData.uuid = randomUUIDv7()

        // Insert the print device
        await trx
          .insertInto('print_devices')
          .values(deviceData)
          .execute()

        createdCount++
      }
    })

    return createdCount
  }
  catch (error) {
    if (error instanceof Error) {
      throw new TypeError(`Failed to create print devices in bulk: ${error.message}`)
    }

    throw error
  }
}
