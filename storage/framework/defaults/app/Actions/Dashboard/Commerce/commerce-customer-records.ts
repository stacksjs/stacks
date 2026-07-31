import {
  commerceCurrency,
  commerceEmail,
  commerceEnum,
  commerceIdentifier,
  commerceNumber,
  commerceOptionalString,
  commerceOptionalTimestamp,
  commerceRequiredString,
  commerceTimestamp,
  commerceUrl,
  commerceValue,
} from './commerce-record'

export type CommerceCustomerStatus = 'Active' | 'Inactive'

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

export function normalizeCommerceCustomerRecord(record: any): CommerceCustomerRecord {
  const id = commerceIdentifier(commerceValue(record, 'id', 'uuid'), 'Customer')
  const source = `Customer ${id}`
  return {
    id,
    name: commerceRequiredString(commerceValue(record, 'name'), source, 'name'),
    email: commerceEmail(commerceValue(record, 'email'), source),
    phone: commerceOptionalString(commerceValue(record, 'phone'), source, 'phone'),
    totalSpent: commerceNumber(commerceValue(record, 'total_spent', 'totalSpent'), source, 'total_spent', { min: 0 }),
    lastOrder: commerceOptionalTimestamp(commerceValue(record, 'last_order', 'lastOrder'), source, 'last_order'),
    status: commerceEnum(commerceValue(record, 'status'), source, 'status', ['Active', 'Inactive']),
    avatar: commerceUrl(commerceValue(record, 'avatar'), source, 'avatar'),
    createdAt: commerceTimestamp(commerceValue(record, 'created_at', 'createdAt'), source),
  }
}

export function normalizeCommerceCustomerCurrency(input: unknown): string {
  return commerceCurrency(input, 'Commerce configuration')
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
