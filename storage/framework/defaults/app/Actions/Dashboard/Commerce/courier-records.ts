import {
  commerceEmail,
  commerceEnum,
  commerceNumber,
  commerceOptionalIdentifier,
  commerceOptionalString,
  commerceOptionalTimestamp,
  commerceRequiredString,
  commerceTimestamp,
  commerceValue,
} from './commerce-record'

export const courierStatuses = ['active', 'on_delivery', 'on_break'] as const
export type CourierStatus = typeof courierStatuses[number]

export interface CourierUser {
  id: number
  name: string
  email: string
}

export interface CourierRecord {
  id: number
  name: string
  phone: string
  vehicle_number: string
  license: string
  status: CourierStatus
  user_id: number | null
  user: CourierUser | null
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

export function indexCourierUsers(records: any[]): Map<number, CourierUser> {
  const result = new Map<number, CourierUser>()
  for (const record of records) {
    const id = numericIdentifier(commerceValue(record, 'id'), 'User')
    const source = `User ${id}`
    if (result.has(id))
      throw new TypeError(`Duplicate User ${id}.`)
    result.set(id, {
      id,
      name: commerceRequiredString(commerceValue(record, 'name'), source, 'name'),
      email: commerceEmail(commerceValue(record, 'email'), source),
    })
  }
  return result
}

export function normalizeCourierRecord(
  record: any,
  users: ReadonlyMap<number, CourierUser>,
): CourierRecord {
  const id = numericIdentifier(commerceValue(record, 'id'), 'Courier')
  const source = `Courier ${id}`
  const userIdentifier = commerceOptionalIdentifier(
    commerceValue(record, 'user_id', 'userId'),
    source,
    'user_id',
  )
  const userId = userIdentifier ? numericIdentifier(userIdentifier, source, 'user_id') : null
  const user = userId ? users.get(userId) : undefined
  if (userId && !user)
    throw new TypeError(`${source}.user_id references missing User ${userId}.`)

  return {
    id,
    name: commerceRequiredString(commerceValue(record, 'name'), source, 'name'),
    phone: commerceRequiredString(commerceValue(record, 'phone'), source, 'phone'),
    vehicle_number: commerceRequiredString(
      commerceValue(record, 'vehicle_number', 'vehicleNumber'),
      source,
      'vehicle_number',
    ),
    license: commerceRequiredString(commerceValue(record, 'license'), source, 'license'),
    status: commerceEnum(commerceValue(record, 'status'), source, 'status', courierStatuses),
    user_id: userId,
    user: user || null,
    created_at: commerceTimestamp(commerceValue(record, 'created_at', 'createdAt'), source),
    updated_at: commerceOptionalTimestamp(commerceValue(record, 'updated_at', 'updatedAt'), source, 'updated_at'),
    uuid: commerceOptionalString(commerceValue(record, 'uuid'), source, 'uuid'),
  }
}
