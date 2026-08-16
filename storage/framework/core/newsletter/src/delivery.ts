export type DeliveryChannel = 'email' | 'sms' | 'push'
export type DeliveryStatus = 'queued' | 'deferred' | 'sending' | 'sent' | 'delivered' | 'failed' | 'undelivered' | 'bounced' | 'complained' | 'suppressed' | 'cancelled'
export type DeliveryFailureClass = 'permanent' | 'transient' | 'rate_limited' | 'suppressed'

export interface DeliveryVariant {
  id: string | number
  allocation: number
}

export interface UsageLimit {
  meter: string
  used: number
  limit: number | null
  requested?: number
}

function stableHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function allocateDeliveryVariant(recipientKey: string, variants: DeliveryVariant[]): DeliveryVariant {
  if (variants.length === 0)
    throw new Error('At least one delivery variant is required')

  const total = variants.reduce((sum, variant) => sum + variant.allocation, 0)
  if (total <= 0)
    throw new Error('Delivery variant allocation must be greater than zero')

  const bucket = stableHash(recipientKey) % total
  let cursor = 0
  for (const variant of variants) {
    if (!Number.isFinite(variant.allocation) || variant.allocation < 0)
      throw new Error('Delivery variant allocation must be a non-negative number')
    cursor += variant.allocation
    if (bucket < cursor)
      return variant
  }

  return variants[variants.length - 1]!
}

export function deliveryIdempotencyKey(input: {
  teamId: string | number
  campaignId: string | number
  channel: DeliveryChannel
  recipient: string
  occurrence?: string
}): string {
  return [
    'delivery', input.teamId, input.campaignId, input.channel,
    input.recipient.trim().toLowerCase(), input.occurrence || 'once',
  ].join(':')
}

export function assertUsageAvailable(limits: UsageLimit[]): void {
  const exceeded = limits.find((entry) => {
    if (entry.limit === null)
      return false
    return entry.used + (entry.requested ?? 1) > entry.limit
  })
  if (exceeded)
    throw new Error(`Usage limit exceeded for ${exceeded.meter}`)
}

export function classifyDeliveryFailure(status: string | number, code = ''): DeliveryFailureClass {
  const normalizedCode = code.toLowerCase()
  if (['suppressed', 'unsubscribe', 'complaint', 'stop'].some(value => normalizedCode.includes(value)))
    return 'suppressed'
  if (Number(status) === 429 || normalizedCode.includes('rate'))
    return 'rate_limited'
  if (Number(status) >= 500 || ['timeout', 'temporary', 'unavailable'].some(value => normalizedCode.includes(value)))
    return 'transient'
  return 'permanent'
}
