import {
  commerceEnum,
  commerceNumber,
  commerceOptionalString,
  commerceOptionalTimestamp,
  commerceRequiredString,
  commerceStringList,
  commerceTimestamp,
  commerceValue,
} from './commerce-record'
import { shippingMethodStatuses } from './shipping-method-records'

export interface ShippingZoneMethod {
  id: number
  name: string
  status: typeof shippingMethodStatuses[number]
}

export interface ShippingZoneRecord {
  id: number
  name: string
  countries: string[]
  regions: string[]
  postal_codes: string[]
  shipping_method_id: number
  status: typeof shippingMethodStatuses[number]
  shipping_method: ShippingZoneMethod
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

export function indexShippingZoneMethods(records: any[]): Map<number, ShippingZoneMethod> {
  const result = new Map<number, ShippingZoneMethod>()
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

export function normalizeShippingZoneRecord(
  record: any,
  methods: ReadonlyMap<number, ShippingZoneMethod>,
): ShippingZoneRecord {
  const id = numericIdentifier(commerceValue(record, 'id'), 'ShippingZone')
  const source = `ShippingZone ${id}`
  const methodId = numericIdentifier(
    commerceValue(record, 'shipping_method_id', 'shippingMethodId'),
    source,
    'shipping_method_id',
  )
  const method = methods.get(methodId)
  if (!method)
    throw new TypeError(`${source}.shipping_method_id references missing ShippingMethod ${methodId}.`)

  return {
    id,
    name: commerceRequiredString(commerceValue(record, 'name'), source, 'name'),
    countries: commerceStringList(commerceValue(record, 'countries'), source, 'countries'),
    regions: commerceStringList(commerceValue(record, 'regions'), source, 'regions'),
    postal_codes: commerceStringList(
      commerceValue(record, 'postal_codes', 'postalCodes'),
      source,
      'postal_codes',
    ),
    shipping_method_id: methodId,
    status: commerceEnum(commerceValue(record, 'status'), source, 'status', shippingMethodStatuses),
    shipping_method: method,
    created_at: commerceTimestamp(commerceValue(record, 'created_at', 'createdAt'), source),
    updated_at: commerceOptionalTimestamp(commerceValue(record, 'updated_at', 'updatedAt'), source, 'updated_at'),
    uuid: commerceOptionalString(commerceValue(record, 'uuid'), source, 'uuid'),
  }
}
