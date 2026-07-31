import {
  commerceEnum,
  commerceNumber,
  commerceOptionalIdentifier,
  commerceOptionalString,
  commerceOptionalTimestamp,
  commerceRequiredString,
  commerceTimestamp,
  commerceValue,
} from './commerce-record'
import type { DriverStatus } from './driver-records'
import { driverStatuses } from './driver-records'

export interface DeliveryRouteDriver {
  id: number
  name: string
  vehicle_number: string
  status: DriverStatus
}

export interface DeliveryRouteRecord {
  id: number
  driver: string
  driver_id: number | null
  driver_record: DeliveryRouteDriver | null
  vehicle: string
  stops: number
  delivery_time: number
  total_distance: number
  last_active: string
  created_at: string
  updated_at: string
  uuid: string
}

function numericIdentifier(input: unknown, source: string, field = 'id'): number {
  const id = commerceNumber(input, source, field, { integer: true, min: 1 })
  if (!Number.isSafeInteger(id))
    throw new TypeError(`${source}.${field} must be a safe positive integer.`)
  return id
}

export function indexDeliveryRouteDrivers(records: any[]): Map<number, DeliveryRouteDriver> {
  const result = new Map<number, DeliveryRouteDriver>()
  for (const record of records) {
    const id = numericIdentifier(commerceValue(record, 'id'), 'Driver')
    const source = `Driver ${id}`
    if (result.has(id))
      throw new TypeError(`Duplicate Driver ${id}.`)
    result.set(id, {
      id,
      name: commerceRequiredString(commerceValue(record, 'name'), source, 'name'),
      vehicle_number: commerceRequiredString(
        commerceValue(record, 'vehicle_number', 'vehicleNumber'),
        source,
        'vehicle_number',
      ),
      status: commerceEnum(commerceValue(record, 'status'), source, 'status', driverStatuses),
    })
  }
  return result
}

export function normalizeDeliveryRouteRecord(
  record: any,
  drivers: ReadonlyMap<number, DeliveryRouteDriver>,
): DeliveryRouteRecord {
  const id = numericIdentifier(commerceValue(record, 'id'), 'DeliveryRoute')
  const source = `DeliveryRoute ${id}`
  const driverIdentifier = commerceOptionalIdentifier(
    commerceValue(record, 'driver_id', 'driverId'),
    source,
    'driver_id',
  )
  const driverId = driverIdentifier
    ? numericIdentifier(driverIdentifier, source, 'driver_id')
    : null
  const driverRecord = driverId ? drivers.get(driverId) : undefined
  if (driverId && !driverRecord)
    throw new TypeError(`${source}.driver_id references missing Driver ${driverId}.`)

  return {
    id,
    driver: commerceRequiredString(commerceValue(record, 'driver'), source, 'driver'),
    driver_id: driverId,
    driver_record: driverRecord || null,
    vehicle: commerceRequiredString(commerceValue(record, 'vehicle'), source, 'vehicle'),
    stops: commerceNumber(commerceValue(record, 'stops'), source, 'stops', {
      integer: true,
      min: 0,
    }),
    delivery_time: commerceNumber(
      commerceValue(record, 'delivery_time', 'deliveryTime'),
      source,
      'delivery_time',
      { integer: true, min: 0 },
    ),
    total_distance: commerceNumber(
      commerceValue(record, 'total_distance', 'totalDistance'),
      source,
      'total_distance',
      { integer: true, min: 0 },
    ),
    last_active: commerceTimestamp(
      commerceValue(record, 'last_active', 'lastActive'),
      source,
      'last_active',
    ),
    created_at: commerceTimestamp(commerceValue(record, 'created_at', 'createdAt'), source),
    updated_at: commerceOptionalTimestamp(commerceValue(record, 'updated_at', 'updatedAt'), source, 'updated_at'),
    uuid: commerceOptionalString(commerceValue(record, 'uuid'), source, 'uuid'),
  }
}
