import {
  commerceEmail,
  commerceEnum,
  commerceIdentifier,
  commerceNumber,
  commerceOptionalIdentifier,
  commerceOptionalNumber,
  commerceOptionalString,
  commerceRequiredString,
  commerceTimestamp,
  commerceValue,
} from './commerce-record'

export interface RestaurantWaitlistRecord {
  id: string
  customerId: string
  name: string
  email: string
  phone: string
  partySize: number
  checkInTime: string
  tablePreference: string
  status: string
  quotedWaitTime: number
  actualWaitTime: number | null
  queuePosition: number | null
  createdAt: string
}

export interface RestaurantWaitlistSummary {
  total: number
  waiting: number
  seated: number
  cancelled: number
  noShow: number
  averageQuotedWait: number
  seatingRate: number
}

export interface RestaurantWaitlistCustomerOption {
  id: string
  label: string
  detail: string
  email: string
  phone: string
}

export interface RestaurantWaitlistOptions {
  customers: RestaurantWaitlistCustomerOption[]
}

export interface RestaurantWaitlistWritePayload {
  customerId: number | null
  name: string
  email: string
  phone: string
  partySize: number
  checkInTime: number
  tablePreference: 'indoor' | 'bar' | 'booth' | 'no_preference'
  status: 'waiting' | 'seated' | 'cancelled' | 'no_show'
  quoted_wait_time: number
  actual_wait_time?: number
  queue_position?: number
}

export function restaurantWaitlistTimestamp(value: string): number {
  const raw = String(value || '').trim()
  if (!raw)
    return 0
  if (/^\d{10,13}$/.test(raw)) {
    const numeric = Number(raw)
    return raw.length === 13 ? Math.floor(numeric / 1000) : numeric
  }
  const source = /^\d{4}-\d{2}-\d{2} \d/.test(raw)
    ? `${raw.replace(' ', 'T')}Z`
    : raw
  const timestamp = new Date(source).getTime()
  if (!Number.isFinite(timestamp))
    throw new TypeError('WaitlistRestaurant.check_in_time must be a valid timestamp.')
  return Math.floor(timestamp / 1000)
}

export function restaurantWaitlistDateTimeLocal(value: string): string {
  const timestamp = restaurantWaitlistTimestamp(value)
  const date = timestamp ? new Date(timestamp * 1000) : new Date()
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

export function normalizeRestaurantWaitlistRecord(
  record: any,
  customerIds?: Set<string>,
): RestaurantWaitlistRecord {
  const id = commerceIdentifier(commerceValue(record, 'id', 'uuid'), 'WaitlistRestaurant')
  const source = `WaitlistRestaurant ${id}`
  const customerId = commerceOptionalIdentifier(
    commerceValue(record, 'customer_id', 'customerId'),
    source,
    'customer_id',
  )
  if (customerId && customerIds && !customerIds.has(customerId))
    throw new TypeError(`${source}.customer_id references missing Customer ${customerId}.`)
  return {
    id,
    customerId,
    name: commerceRequiredString(commerceValue(record, 'name'), source, 'name'),
    email: commerceEmail(commerceValue(record, 'email'), source),
    phone: commerceOptionalString(commerceValue(record, 'phone'), source, 'phone'),
    partySize: commerceNumber(
      commerceValue(record, 'party_size', 'partySize'),
      source,
      'party_size',
      { min: 1, integer: true },
    ),
    checkInTime: commerceTimestamp(
      commerceValue(record, 'check_in_time', 'checkInTime'),
      source,
      'check_in_time',
    ),
    tablePreference: commerceEnum(
      commerceValue(record, 'table_preference', 'tablePreference'),
      source,
      'table_preference',
      ['indoor', 'bar', 'booth', 'no_preference'],
    ),
    status: commerceEnum(commerceValue(record, 'status'), source, 'status', [
      'waiting',
      'seated',
      'cancelled',
      'no_show',
    ]),
    quotedWaitTime: commerceNumber(
      commerceValue(record, 'quoted_wait_time', 'quotedWaitTime'),
      source,
      'quoted_wait_time',
      { min: 0, integer: true },
    ),
    actualWaitTime: commerceOptionalNumber(
      commerceValue(record, 'actual_wait_time', 'actualWaitTime'),
      source,
      'actual_wait_time',
      { min: 0, integer: true },
    ),
    queuePosition: commerceOptionalNumber(
      commerceValue(record, 'queue_position', 'queuePosition'),
      source,
      'queue_position',
      { min: 1, integer: true },
    ),
    createdAt: commerceTimestamp(commerceValue(record, 'created_at', 'createdAt'), source),
  }
}

export function normalizeRestaurantWaitlistCustomerOption(record: any): RestaurantWaitlistCustomerOption {
  const id = commerceIdentifier(commerceValue(record, 'id', 'uuid'), 'Customer')
  const source = `Customer ${id}`
  const email = commerceEmail(commerceValue(record, 'email'), source)
  const phone = commerceOptionalString(commerceValue(record, 'phone'), source, 'phone')
  return {
    id,
    label: commerceRequiredString(commerceValue(record, 'name'), source, 'name'),
    detail: email || phone,
    email,
    phone,
  }
}

export function summarizeRestaurantWaitlist(records: RestaurantWaitlistRecord[]): RestaurantWaitlistSummary {
  const waitingRecords = records.filter(record => record.status === 'waiting')
  const seated = records.filter(record => record.status === 'seated').length
  const cancelled = records.filter(record => record.status === 'cancelled').length
  const noShow = records.filter(record => record.status === 'no_show').length
  const averageQuotedWait = waitingRecords.length === 0
    ? 0
    : Math.round(waitingRecords.reduce((total, record) => total + record.quotedWaitTime, 0) / waitingRecords.length)

  return {
    total: records.length,
    waiting: waitingRecords.length,
    seated,
    cancelled,
    noShow,
    averageQuotedWait,
    seatingRate: records.length === 0 ? 0 : Math.round((seated / records.length) * 1000) / 10,
  }
}
