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

export function normalizeGiftCardRecord(
  record: any,
  customerIds = new Set<string>(),
): GiftCardRecord {
  const id = commerceIdentifier(commerceValue(record, 'id', 'uuid'), 'GiftCard')
  const source = `GiftCard ${id}`
  const customerId = commerceOptionalIdentifier(
    commerceValue(record, 'customer_id', 'customerId'),
    source,
    'customer_id',
  )
  if (customerId && !customerIds.has(customerId))
    throw new TypeError(`${source}.customer_id references missing Customer ${customerId}.`)

  return {
    id,
    code: commerceRequiredString(commerceValue(record, 'code'), source, 'code'),
    initialBalance: commerceNumber(
      commerceValue(record, 'initial_balance', 'initialBalance'),
      source,
      'initial_balance',
      { min: 1 },
    ),
    currentBalance: commerceNumber(
      commerceValue(record, 'current_balance', 'currentBalance'),
      source,
      'current_balance',
      { min: 0 },
    ),
    currency: commerceCurrency(commerceValue(record, 'currency'), source),
    status: commerceEnum(commerceValue(record, 'status'), source, 'status', [
      'ACTIVE',
      'USED',
      'EXPIRED',
      'DEACTIVATED',
    ]),
    purchaserId: commerceOptionalString(
      commerceValue(record, 'purchaser_id', 'purchaserId'),
      source,
      'purchaser_id',
    ),
    recipientEmail: commerceOptionalEmail(
      commerceValue(record, 'recipient_email', 'recipientEmail'),
      source,
      'recipient_email',
    ),
    recipientName: commerceOptionalString(
      commerceValue(record, 'recipient_name', 'recipientName'),
      source,
      'recipient_name',
    ),
    personalMessage: commerceOptionalString(
      commerceValue(record, 'personal_message', 'personalMessage'),
      source,
      'personal_message',
    ),
    isDigital: commerceBoolean(
      commerceValue(record, 'is_digital', 'isDigital'),
      source,
      'is_digital',
    ),
    isReloadable: commerceBoolean(
      commerceValue(record, 'is_reloadable', 'isReloadable'),
      source,
      'is_reloadable',
    ),
    isActive: commerceBoolean(
      commerceValue(record, 'is_active', 'isActive'),
      source,
      'is_active',
    ),
    expiryDate: commerceOptionalTimestamp(
      commerceValue(record, 'expiry_date', 'expiryDate'),
      source,
      'expiry_date',
    ),
    lastUsedDate: commerceOptionalTimestamp(
      commerceValue(record, 'last_used_date', 'lastUsedDate'),
      source,
      'last_used_date',
    ),
    templateId: commerceOptionalString(
      commerceValue(record, 'template_id', 'templateId'),
      source,
      'template_id',
    ),
    customerId,
    createdAt: commerceTimestamp(commerceValue(record, 'created_at', 'createdAt'), source),
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
import {
  commerceBoolean,
  commerceCurrency,
  commerceEnum,
  commerceIdentifier,
  commerceNumber,
  commerceOptionalEmail,
  commerceOptionalIdentifier,
  commerceOptionalString,
  commerceOptionalTimestamp,
  commerceRequiredString,
  commerceTimestamp,
  commerceValue,
} from './commerce-record'
