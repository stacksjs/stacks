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

function value(record: any, ...keys: string[]): unknown {
  for (const key of keys) {
    const result = typeof record?.get === 'function' ? record.get(key) : record?.[key]
    if (result !== undefined && result !== null)
      return result
  }
  return undefined
}

function text(input: unknown): string {
  return input === undefined || input === null ? '' : String(input)
}

function numeric(input: unknown): number {
  const result = Number(input)
  return Number.isFinite(result) ? result : 0
}

function nullableNumeric(input: unknown): number | null {
  if (input === undefined || input === null || input === '')
    return null
  const result = Number(input)
  return Number.isFinite(result) ? result : null
}

export function normalizeRestaurantWaitlistRecord(record: any): RestaurantWaitlistRecord {
  return {
    id: text(value(record, 'id')),
    customerId: text(value(record, 'customer_id', 'customerId')),
    name: text(value(record, 'name')),
    email: text(value(record, 'email')),
    phone: text(value(record, 'phone')),
    partySize: numeric(value(record, 'party_size', 'partySize')),
    checkInTime: text(value(record, 'check_in_time', 'checkInTime')),
    tablePreference: text(value(record, 'table_preference', 'tablePreference')),
    status: text(value(record, 'status')).toLowerCase(),
    quotedWaitTime: numeric(value(record, 'quoted_wait_time', 'quotedWaitTime')),
    actualWaitTime: nullableNumeric(value(record, 'actual_wait_time', 'actualWaitTime')),
    queuePosition: nullableNumeric(value(record, 'queue_position', 'queuePosition')),
    createdAt: text(value(record, 'created_at', 'createdAt')),
  }
}

export function normalizeRestaurantWaitlistCustomerOption(record: any): RestaurantWaitlistCustomerOption {
  return {
    id: text(value(record, 'id')),
    label: text(value(record, 'name')) || 'Unnamed customer',
    detail: text(value(record, 'email')) || text(value(record, 'phone')),
    email: text(value(record, 'email')),
    phone: text(value(record, 'phone')),
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
