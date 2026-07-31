import {
  commerceBoolean,
  commerceEnum,
  commerceNumber,
  commerceOptionalNumber,
  commerceOptionalString,
  commerceOptionalTimestamp,
  commerceRequiredString,
  commerceTimestamp,
  commerceValue,
} from './commerce-record'

export const digitalDeliveryStatuses = ['active', 'inactive'] as const
export type DigitalDeliveryStatus = typeof digitalDeliveryStatuses[number]

export interface DigitalDeliveryRecord {
  id: number
  name: string
  description: string
  download_limit: number | null
  expiry_days: number
  requires_login: boolean
  automatic_delivery: boolean
  status: DigitalDeliveryStatus
  created_at: string
  updated_at: string
  uuid: string
}

export function normalizeDigitalDeliveryRecord(record: any): DigitalDeliveryRecord {
  const id = commerceNumber(commerceValue(record, 'id'), 'DigitalDelivery', 'id', {
    integer: true,
    min: 1,
  })
  if (!Number.isSafeInteger(id))
    throw new TypeError('DigitalDelivery.id must be a safe positive integer.')
  const source = `DigitalDelivery ${id}`

  return {
    id,
    name: commerceRequiredString(commerceValue(record, 'name'), source, 'name'),
    description: commerceRequiredString(commerceValue(record, 'description'), source, 'description'),
    download_limit: commerceOptionalNumber(
      commerceValue(record, 'download_limit', 'downloadLimit'),
      source,
      'download_limit',
      { integer: true, min: 0 },
    ),
    expiry_days: commerceNumber(
      commerceValue(record, 'expiry_days', 'expiryDays'),
      source,
      'expiry_days',
      { integer: true, min: 0 },
    ),
    requires_login: commerceBoolean(
      commerceValue(record, 'requires_login', 'requiresLogin'),
      source,
      'requires_login',
    ),
    automatic_delivery: commerceBoolean(
      commerceValue(record, 'automatic_delivery', 'automaticDelivery'),
      source,
      'automatic_delivery',
    ),
    status: commerceEnum(commerceValue(record, 'status'), source, 'status', digitalDeliveryStatuses),
    created_at: commerceTimestamp(commerceValue(record, 'created_at', 'createdAt'), source),
    updated_at: commerceOptionalTimestamp(commerceValue(record, 'updated_at', 'updatedAt'), source, 'updated_at'),
    uuid: commerceOptionalString(commerceValue(record, 'uuid'), source, 'uuid'),
  }
}
