import { dashboardApi } from '../dashboard-api'

export interface BillingSubscription {
  id: string
  plan: string
  type: string
  status: string
  amount: number | null
  currency: string
  periodEnd: string
  cancelAtPeriodEnd: boolean
}

export interface BillingPaymentMethod {
  id: string
  brand: string
  lastFour: string
  expMonth: number | null
  expYear: number | null
  isDefault: boolean
}

export interface BillingTransaction {
  id: string
  name: string
  description: string
  amount: number | null
  type: string
  providerId: string
}

export interface BillingOverview {
  subscription: BillingSubscription | null
  paymentMethods: BillingPaymentMethod[]
  transactions: BillingTransaction[]
  unavailable: string[]
}

type UnknownRecord = Record<string, any>

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {}
}

function records(value: unknown): UnknownRecord[] {
  if (Array.isArray(value))
    return value.map(record)

  const data = record(value).data
  return Array.isArray(data) ? data.map(record) : []
}

function text(...values: unknown[]): string {
  const value = values.find(item => typeof item === 'string' && item.trim())
  return typeof value === 'string' ? value.trim() : ''
}

function number(value: unknown): number | null {
  if (value === null || value === undefined || value === '')
    return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function timestamp(value: unknown): string {
  if (typeof value === 'number') {
    const milliseconds = value < 10_000_000_000 ? value * 1000 : value
    return new Date(milliseconds).toISOString()
  }
  return typeof value === 'string' ? value : ''
}

function normalizeSubscription(value: unknown): BillingSubscription | null {
  const result = record(value)
  const stored = record(result.subscription || result)
  const provider = record(result.providerSubscription || result.provider_subscription)
  if (Object.keys(stored).length === 0)
    return null

  const price = record(records(record(provider.items).data)[0]?.price)

  return {
    id: text(stored.id, stored.uuid, stored.provider_id, stored.providerId),
    plan: text(stored.plan, stored.type, price.nickname, price.lookup_key),
    type: text(stored.type, stored.plan),
    status: text(stored.provider_status, stored.providerStatus, provider.status),
    amount: number(stored.unit_price ?? stored.unitPrice ?? price.unit_amount),
    currency: text(price.currency, provider.currency),
    periodEnd: timestamp(provider.current_period_end ?? stored.ends_at ?? stored.endsAt),
    cancelAtPeriodEnd: Boolean(provider.cancel_at_period_end),
  }
}

function normalizePaymentMethod(value: unknown, defaultId: string): BillingPaymentMethod {
  const method = record(value)
  const card = record(method.card)
  const id = text(method.id, method.provider_id, method.providerId, method.uuid)

  return {
    id,
    brand: text(card.brand, method.brand, method.type),
    lastFour: text(card.last4, method.last_four, method.lastFour),
    expMonth: number(card.exp_month ?? method.exp_month ?? method.expMonth),
    expYear: number(card.exp_year ?? method.exp_year ?? method.expYear),
    isDefault: Boolean(method.is_default ?? method.isDefault) || Boolean(id && id === defaultId),
  }
}

function normalizeTransaction(value: unknown): BillingTransaction {
  const transaction = record(value)
  return {
    id: text(transaction.id, transaction.uuid, transaction.provider_id, transaction.providerId),
    name: text(transaction.name),
    description: text(transaction.description),
    amount: number(transaction.amount),
    type: text(transaction.type),
    providerId: text(transaction.provider_id, transaction.providerId),
  }
}

export async function fetchBillingOverview(): Promise<BillingOverview> {
  const payload = record(await dashboardApi('/api/dashboard/billing'))
  const defaultMethod = record(payload.defaultPaymentMethod)
  const defaultId = text(defaultMethod.id, defaultMethod.provider_id, defaultMethod.providerId, defaultMethod.uuid)
  const paymentMethods = records(payload.paymentMethods).map(method => normalizePaymentMethod(method, defaultId))

  if (defaultId && !paymentMethods.some(method => method.id === defaultId))
    paymentMethods.unshift(normalizePaymentMethod(defaultMethod, defaultId))

  return {
    subscription: normalizeSubscription(payload.subscription),
    paymentMethods,
    transactions: records(payload.transactions).map(normalizeTransaction),
    unavailable: Array.isArray(payload.unavailable)
      ? payload.unavailable.map(item => String(item)).filter(Boolean)
      : [],
  }
}
