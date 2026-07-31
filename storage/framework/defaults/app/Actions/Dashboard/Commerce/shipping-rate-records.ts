import {
  commerceEnum,
  commerceNumber,
  commerceOptionalString,
  commerceOptionalTimestamp,
  commerceRequiredString,
  commerceTimestamp,
  commerceValue,
} from './commerce-record'
import { shippingMethodStatuses } from './shipping-method-records'

export interface ShippingRateMethod {
  id: number
  name: string
  status: typeof shippingMethodStatuses[number]
}

export interface ShippingRateZone {
  id: number
  name: string
  status: typeof shippingMethodStatuses[number]
  shippingMethodId: number
}

export interface ShippingRateRecord {
  id: number
  shipping_method_id: number
  shipping_zone_id: number
  weight_from: number
  weight_to: number
  rate: number
  shipping_method: ShippingRateMethod
  shipping_zone: Omit<ShippingRateZone, 'shippingMethodId'>
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

export function indexShippingRateMethods(records: any[]): Map<number, ShippingRateMethod> {
  const result = new Map<number, ShippingRateMethod>()
  for (const record of records) {
    const id = numericIdentifier(commerceValue(record, 'id'), 'ShippingMethod')
    const source = `ShippingMethod ${id}`
    if (result.has(id))
      throw new TypeError(`Duplicate ShippingMethod ${id}.`)
    result.set(id, {
      id,
      name: commerceRequiredString(commerceValue(record, 'name'), source, 'name'),
      status: commerceEnum(commerceValue(record, 'status'), source, 'status', shippingMethodStatuses),
    })
  }
  return result
}

export function indexShippingRateZones(records: any[]): Map<number, ShippingRateZone> {
  const result = new Map<number, ShippingRateZone>()
  for (const record of records) {
    const id = numericIdentifier(commerceValue(record, 'id'), 'ShippingZone')
    const source = `ShippingZone ${id}`
    if (result.has(id))
      throw new TypeError(`Duplicate ShippingZone ${id}.`)
    result.set(id, {
      id,
      name: commerceRequiredString(commerceValue(record, 'name'), source, 'name'),
      status: commerceEnum(commerceValue(record, 'status'), source, 'status', shippingMethodStatuses),
      shippingMethodId: numericIdentifier(
        commerceValue(record, 'shipping_method_id', 'shippingMethodId'),
        source,
        'shipping_method_id',
      ),
    })
  }
  return result
}

export function normalizeShippingRateRecord(
  record: any,
  methods: ReadonlyMap<number, ShippingRateMethod>,
  zones: ReadonlyMap<number, ShippingRateZone>,
): ShippingRateRecord {
  const id = numericIdentifier(commerceValue(record, 'id'), 'ShippingRate')
  const source = `ShippingRate ${id}`
  const methodId = numericIdentifier(
    commerceValue(record, 'shipping_method_id', 'shippingMethodId'),
    source,
    'shipping_method_id',
  )
  const zoneId = numericIdentifier(
    commerceValue(record, 'shipping_zone_id', 'shippingZoneId'),
    source,
    'shipping_zone_id',
  )
  const method = methods.get(methodId)
  const zone = zones.get(zoneId)
  if (!method)
    throw new TypeError(`${source}.shipping_method_id references missing ShippingMethod ${methodId}.`)
  if (!zone)
    throw new TypeError(`${source}.shipping_zone_id references missing ShippingZone ${zoneId}.`)
  if (zone.shippingMethodId !== methodId) {
    throw new TypeError(
      `${source}.shipping_zone_id references ShippingZone ${zoneId} assigned to ShippingMethod ${zone.shippingMethodId}.`,
    )
  }

  const weightFrom = commerceNumber(
    commerceValue(record, 'weight_from', 'weightFrom'),
    source,
    'weight_from',
    { min: 0 },
  )
  const weightTo = commerceNumber(
    commerceValue(record, 'weight_to', 'weightTo'),
    source,
    'weight_to',
    { min: 0 },
  )
  if (weightTo < weightFrom)
    throw new TypeError(`${source}.weight_to must be greater than or equal to weight_from.`)

  return {
    id,
    shipping_method_id: methodId,
    shipping_zone_id: zoneId,
    weight_from: weightFrom,
    weight_to: weightTo,
    rate: commerceNumber(commerceValue(record, 'rate'), source, 'rate', {
      integer: true,
      min: 0,
    }),
    shipping_method: method,
    shipping_zone: {
      id: zone.id,
      name: zone.name,
      status: zone.status,
    },
    created_at: commerceTimestamp(commerceValue(record, 'created_at', 'createdAt'), source),
    updated_at: commerceOptionalTimestamp(commerceValue(record, 'updated_at', 'updatedAt'), source, 'updated_at'),
    uuid: commerceOptionalString(commerceValue(record, 'uuid'), source, 'uuid'),
  }
}
