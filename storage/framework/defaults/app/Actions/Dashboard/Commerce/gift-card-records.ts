export type GiftCardStatus = 'ACTIVE' | 'USED' | 'EXPIRED' | 'DEACTIVATED'

export interface GiftCardRecord {
  id: string
  code: string
  initialBalance: number
  currentBalance: number
  currency: string
  status: GiftCardStatus
  purchaserId: string
  recipientEmail: string
  recipientName: string
  personalMessage: string
  isDigital: boolean
  isReloadable: boolean
  isActive: boolean
  expiryDate: string
  lastUsedDate: string
  templateId: string
  customerId: string
  createdAt: string
}

export interface GiftCardCurrencySummary {
  currency: string
  cards: number
  initialBalance: number
  currentBalance: number
  redeemedBalance: number
}

export interface GiftCardSummary {
  total: number
  available: number
  enabled: number
  digital: number
  reloadable: number
  statuses: Record<GiftCardStatus, number>
  currencies: GiftCardCurrencySummary[]
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

function number(input: unknown): number {
  const result = Number(input)
  return Number.isFinite(result) ? result : 0
}

function boolean(input: unknown): boolean {
  return input === true || input === 1 || input === '1' || input === 'true'
}

function status(input: unknown): GiftCardStatus {
  const result = text(input).toUpperCase()
  if (result === 'ACTIVE' || result === 'USED' || result === 'EXPIRED')
    return result
  return 'DEACTIVATED'
}

function currency(input: unknown): string {
  const result = text(input).trim().toUpperCase()
  return /^[A-Z]{3}$/.test(result) ? result : 'USD'
}

function dateTime(input: unknown): string {
  const result = text(input).trim()
  if (!result)
    return ''

  if (/^\d{10}$/.test(result)) {
    const parsed = new Date(Number(result) * 1000)
    return Number.isNaN(parsed.getTime()) ? result : parsed.toISOString()
  }

  const sqlDate = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(result)
  if (sqlDate) {
    const [, year, month, day, hour, minute, second] = sqlDate
    const parsed = new Date(Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ))
    return Number.isNaN(parsed.getTime()) ? result : parsed.toISOString()
  }

  const parsed = new Date(result)
  return Number.isNaN(parsed.getTime()) ? result : parsed.toISOString()
}

export function normalizeGiftCardRecord(record: any): GiftCardRecord {
  const initialBalance = Math.max(0, number(value(record, 'initial_balance', 'initialBalance')))
  return {
    id: text(value(record, 'id', 'uuid')),
    code: text(value(record, 'code')),
    initialBalance,
    currentBalance: Math.min(initialBalance, Math.max(0, number(value(record, 'current_balance', 'currentBalance')))),
    currency: currency(value(record, 'currency')),
    status: status(value(record, 'status')),
    purchaserId: text(value(record, 'purchaser_id', 'purchaserId')),
    recipientEmail: text(value(record, 'recipient_email', 'recipientEmail')),
    recipientName: text(value(record, 'recipient_name', 'recipientName')),
    personalMessage: text(value(record, 'personal_message', 'personalMessage')),
    isDigital: boolean(value(record, 'is_digital', 'isDigital')),
    isReloadable: boolean(value(record, 'is_reloadable', 'isReloadable')),
    isActive: boolean(value(record, 'is_active', 'isActive')),
    expiryDate: dateTime(value(record, 'expiry_date', 'expiryDate')),
    lastUsedDate: dateTime(value(record, 'last_used_date', 'lastUsedDate')),
    templateId: text(value(record, 'template_id', 'templateId')),
    customerId: text(value(record, 'customer_id', 'customerId')),
    createdAt: dateTime(value(record, 'created_at', 'createdAt')),
  }
}

export function summarizeGiftCards(records: GiftCardRecord[]): GiftCardSummary {
  const currencies = new Map<string, GiftCardCurrencySummary>()
  const statuses: Record<GiftCardStatus, number> = {
    ACTIVE: 0,
    USED: 0,
    EXPIRED: 0,
    DEACTIVATED: 0,
  }

  for (const record of records) {
    statuses[record.status] += 1
    const current = currencies.get(record.currency) ?? {
      currency: record.currency,
      cards: 0,
      initialBalance: 0,
      currentBalance: 0,
      redeemedBalance: 0,
    }
    current.cards += 1
    current.initialBalance += record.initialBalance
    current.currentBalance += record.currentBalance
    current.redeemedBalance += Math.max(0, record.initialBalance - record.currentBalance)
    currencies.set(record.currency, current)
  }

  return {
    total: records.length,
    available: records.filter(record => record.status === 'ACTIVE' && record.isActive && record.currentBalance > 0).length,
    enabled: records.filter(record => record.isActive).length,
    digital: records.filter(record => record.isDigital).length,
    reloadable: records.filter(record => record.isReloadable).length,
    statuses,
    currencies: [...currencies.values()].sort((left, right) => left.currency.localeCompare(right.currency)),
  }
}
