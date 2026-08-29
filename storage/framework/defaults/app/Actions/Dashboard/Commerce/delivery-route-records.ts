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
import type { CourierStatus } from './courier-records'
import { courierStatuses } from './courier-records'

export interface DeliveryRouteCourier {
  id: number
  name: string
  vehicle_number: string
  status: CourierStatus
}

export interface DeliveryRouteRecord {
  id: number
  courier: string
  courier_id: number | null
  courier_record: DeliveryRouteCourier | null
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

export function indexDeliveryRouteCouriers(records: any[]): Map<number, DeliveryRouteCourier> {
  const result = new Map<number, DeliveryRouteCourier>()
  for (const record of records) {
    const id = numericIdentifier(commerceValue(record, 'id'), 'Courier')
    const source = `Courier ${id}`
    if (result.has(id))
      throw new TypeError(`Duplicate Courier ${id}.`)
    result.set(id, {
      id,
      name: commerceRequiredString(commerceValue(record, 'name'), source, 'name'),
      vehicle_number: commerceRequiredString(
        commerceValue(record, 'vehicle_number', 'vehicleNumber'),
        source,
        'vehicle_number',
      ),
      status: commerceEnum(commerceValue(record, 'status'), source, 'status', courierStatuses),
    })
  }
  return result
}

export function normalizeDeliveryRouteRecord(
  record: any,
  couriers: ReadonlyMap<number, DeliveryRouteCourier>,
): DeliveryRouteRecord {
  const id = numericIdentifier(commerceValue(record, 'id'), 'DeliveryRoute')
  const source = `DeliveryRoute ${id}`
  const courierIdentifier = commerceOptionalIdentifier(
    commerceValue(record, 'courier_id', 'courierId'),
    source,
    'courier_id',
  )
  const courierId = courierIdentifier
    ? numericIdentifier(courierIdentifier, source, 'courier_id')
    : null
  const courierRecord = courierId ? couriers.get(courierId) : undefined
  if (courierId && !courierRecord)
    throw new TypeError(`${source}.courier_id references missing Courier ${courierId}.`)

  return {
    id,
    courier: commerceRequiredString(commerceValue(record, 'courier'), source, 'courier'),
    courier_id: courierId,
    courier_record: courierRecord || null,
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
