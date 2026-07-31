import { db } from '@stacksjs/database'

type DeliveryRouteWriteData = Record<string, unknown>

export class DeliveryRouteInputError extends TypeError {
  constructor(message: string) {
    super(message)
    this.name = 'DeliveryRouteInputError'
  }
}

function numericValue(
  input: DeliveryRouteWriteData,
  current: DeliveryRouteWriteData | undefined,
  key: string,
): number {
  return Number(input[key] ?? current?.[key])
}

function timestampValue(
  input: DeliveryRouteWriteData,
  current?: DeliveryRouteWriteData,
): number {
  const value = input.last_active ?? current?.last_active
  if (value instanceof Date)
    return value.getTime()
  if (typeof value === 'number')
    return value
  if (typeof value === 'string' && /^\d{10,13}$/.test(value))
    return Number(value)
  return Number.NaN
}

export async function validateDeliveryRouteWrite(
  input: DeliveryRouteWriteData,
  current?: DeliveryRouteWriteData,
): Promise<DeliveryRouteWriteData> {
  const driverId = numericValue(input, current, 'driver_id')
  const stops = numericValue(input, current, 'stops')
  const deliveryTime = numericValue(input, current, 'delivery_time')
  const totalDistance = numericValue(input, current, 'total_distance')
  const lastActive = timestampValue(input, current)

  if (!Number.isSafeInteger(driverId) || driverId < 1)
    throw new DeliveryRouteInputError('Driver must be a positive integer.')
  if (!Number.isSafeInteger(stops) || stops < 0)
    throw new DeliveryRouteInputError('Stops must be a non-negative integer.')
  if (!Number.isSafeInteger(deliveryTime) || deliveryTime < 0)
    throw new DeliveryRouteInputError('Delivery time must be a non-negative integer.')
  if (!Number.isSafeInteger(totalDistance) || totalDistance < 0)
    throw new DeliveryRouteInputError('Total distance must be a non-negative integer.')
  if (!Number.isSafeInteger(lastActive) || lastActive < 0)
    throw new DeliveryRouteInputError('Last active must be a valid Unix timestamp.')

  const driver = await db
    .selectFrom('drivers')
    .where('id', '=', driverId)
    .select(['id', 'name', 'vehicle_number'])
    .executeTakeFirst()
  if (!driver)
    throw new DeliveryRouteInputError(`Driver ${driverId} was not found.`)

  return {
    ...input,
    driver_id: Number(driver.id),
    driver: driver.name,
    vehicle: driver.vehicle_number,
  }
}
