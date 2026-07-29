export type CommerceCustomerStatus = 'Active' | 'Inactive' | 'Unknown'

export interface CommerceCustomerRecord {
  id: string
  name: string
  email: string
  phone: string
  totalSpent: number
  lastOrder: string
  status: CommerceCustomerStatus
  avatar: string
  createdAt: string
}

export interface CommerceCustomerSummary {
  total: number
  active: number
  inactive: number
  totalSpent: number
  averageSpent: number
}

function value(record: any, ...keys: string[]): unknown {
  for (const key of keys) {
    const result = typeof record?.get === 'function' ? record.get(key) : record?.[key]
    if (result !== null && result !== undefined)
      return result
  }
  return undefined
}

function text(input: unknown): string {
  return input === null || input === undefined ? '' : String(input)
}

function nonNegativeNumber(input: unknown): number {
  const result = Number(input)
  return Number.isFinite(result) && result >= 0 ? result : 0
}

function status(input: unknown): CommerceCustomerStatus {
  const result = text(input)
  if (result === 'Active' || result === 'Inactive')
    return result
  return 'Unknown'
}

export function normalizeCommerceCustomerRecord(record: any): CommerceCustomerRecord {
  return {
    id: text(value(record, 'id', 'uuid')),
    name: text(value(record, 'name')),
    email: text(value(record, 'email')),
    phone: text(value(record, 'phone')),
    totalSpent: nonNegativeNumber(value(record, 'total_spent', 'totalSpent')),
    lastOrder: text(value(record, 'last_order', 'lastOrder')),
    status: status(value(record, 'status')),
    avatar: text(value(record, 'avatar')),
    createdAt: text(value(record, 'created_at', 'createdAt')),
  }
}

export function summarizeCommerceCustomers(records: CommerceCustomerRecord[]): CommerceCustomerSummary {
  const totalSpent = records.reduce((sum, record) => sum + record.totalSpent, 0)
  return {
    total: records.length,
    active: records.filter(record => record.status === 'Active').length,
    inactive: records.filter(record => record.status === 'Inactive').length,
    totalSpent,
    averageSpent: records.length > 0 ? totalSpent / records.length : 0,
  }
}
