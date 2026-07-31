import {
  commerceEnum,
  commerceNumber,
  commerceOptionalNumber,
  commerceOptionalString,
  commerceOptionalTimestamp,
  commerceRequiredString,
  commerceTimestamp,
  commerceValue,
} from './commerce-record'

export const shippingMethodStatuses = ['active', 'inactive', 'draft'] as const
export type ShippingMethodStatus = typeof shippingMethodStatuses[number]

export interface ShippingZoneSummary {
  id: number
  name: string
}

export interface ShippingMethodRecord {
  id: number
  name: string
  description: string
  base_rate: number
  free_shipping: number | null
  status: ShippingMethodStatus
  shipping_zones: ShippingZoneSummary[]
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

export function groupShippingMethodZones(
  records: any[],
  methodIds: ReadonlySet<number>,
): Map<number, ShippingZoneSummary[]> {
  const result = new Map<number, ShippingZoneSummary[]>()
  const zoneIds = new Set<number>()
  for (const record of records) {
    const id = numericIdentifier(commerceValue(record, 'id'), 'ShippingZone')
    const source = `ShippingZone ${id}`
    if (zoneIds.has(id))
      throw new TypeError(`Duplicate ShippingZone ${id}.`)
    zoneIds.add(id)
    const methodId = numericIdentifier(
      commerceValue(record, 'shipping_method_id', 'shippingMethodId'),
      source,
      'shipping_method_id',
    )
    if (!methodIds.has(methodId))
      throw new TypeError(`${source}.shipping_method_id references missing ShippingMethod ${methodId}.`)
    const zones = result.get(methodId) || []
    zones.push({
      id,
      name: commerceRequiredString(commerceValue(record, 'name'), source, 'name'),
    })
    result.set(methodId, zones)
  }
  return result
}

export function normalizeShippingMethodRecord(
  record: any,
  zonesByMethodId: ReadonlyMap<number, ShippingZoneSummary[]>,
): ShippingMethodRecord {
  const id = numericIdentifier(commerceValue(record, 'id'), 'ShippingMethod')
  const source = `ShippingMethod ${id}`
  return {
    id,
    name: commerceRequiredString(commerceValue(record, 'name'), source, 'name'),
    description: commerceOptionalString(commerceValue(record, 'description'), source, 'description'),
    base_rate: commerceNumber(commerceValue(record, 'base_rate', 'baseRate'), source, 'base_rate', {
      integer: true,
      min: 0,
    }),
    free_shipping: commerceOptionalNumber(
      commerceValue(record, 'free_shipping', 'freeShipping'),
      source,
      'free_shipping',
      { integer: true, min: 0 },
    ),
    status: commerceEnum(commerceValue(record, 'status'), source, 'status', shippingMethodStatuses),
    shipping_zones: zonesByMethodId.get(id) || [],
    created_at: commerceTimestamp(commerceValue(record, 'created_at', 'createdAt'), source),
    updated_at: commerceOptionalTimestamp(commerceValue(record, 'updated_at', 'updatedAt'), source, 'updated_at'),
    uuid: commerceOptionalString(commerceValue(record, 'uuid'), source, 'uuid'),
  }
}

export function shippingMethodIds(records: any[]): Set<number> {
  const result = new Set<number>()
  for (const record of records) {
    const id = numericIdentifier(commerceValue(record, 'id'), 'ShippingMethod')
    if (result.has(id))
      throw new TypeError(`Duplicate ShippingMethod ${id}.`)
    result.add(id)
  }
  return result
}
