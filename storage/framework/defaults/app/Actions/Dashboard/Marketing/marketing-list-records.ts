export type MarketingListStatus = 'active' | 'inactive' | 'archived'

export interface MarketingListRecord {
  id: string
  name: string
  slug: string
  description: string
  status: MarketingListStatus
  isPublic: boolean
  doubleOptIn: boolean
  subscriberCount: number
  activeCount: number
  unsubscribedCount: number
  bouncedCount: number
  storedSubscriberCount: number
  countDrift: boolean
  campaignCount: number
  lastSentAt: string
  createdAt: string
}

export interface MarketingListSummary {
  total: number
  active: number
  subscribers: number
  newThisWeek: number
  campaigns: number
  counterDriftLists: number
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
  return Number.isFinite(result) && result >= 0 ? result : 0
}

function boolean(input: unknown): boolean {
  return input === true || input === 1 || input === '1' || input === 'true'
}

function status(input: unknown): MarketingListStatus {
  const normalized = text(input).toLowerCase()
  return ['active', 'inactive', 'archived'].includes(normalized)
    ? normalized as MarketingListStatus
    : 'inactive'
}

function countsByList(rows: any[]): Map<string, Record<string, number>> {
  const counts = new Map<string, Record<string, number>>()
  for (const row of rows) {
    const listId = text(value(row, 'email_list_id', 'emailListId'))
    const state = text(value(row, 'status')).toLowerCase()
    if (!listId || !state)
      continue
    const current = counts.get(listId) || {}
    current[state] = number(value(row, 'count'))
    counts.set(listId, current)
  }
  return counts
}

export function normalizeMarketingLists(
  listRows: any[],
  membershipRows: any[],
  newMembershipRows: any[],
  campaignRows: any[],
): { records: MarketingListRecord[], summary: MarketingListSummary } {
  const memberships = countsByList(membershipRows)
  const newMemberships = new Map(newMembershipRows.map(row => [
    text(value(row, 'email_list_id', 'emailListId')),
    number(value(row, 'count')),
  ]))
  const campaigns = new Map(campaignRows.map(row => [
    text(value(row, 'email_list_id', 'emailListId')),
    {
      count: number(value(row, 'count')),
      lastSentAt: text(value(row, 'last_sent_at', 'lastSentAt')),
    },
  ]))

  const records = listRows.map((list): MarketingListRecord => {
    const id = text(value(list, 'id'))
    const membership = memberships.get(id) || {}
    const subscribed = membership.subscribed || 0
    const pending = membership.pending || 0
    const storedSubscriberCount = number(value(list, 'subscriber_count', 'subscriberCount'))
    const campaign = campaigns.get(id)
    return {
      id,
      name: text(value(list, 'name')),
      slug: text(value(list, 'slug')),
      description: text(value(list, 'description')),
      status: status(value(list, 'status')),
      isPublic: boolean(value(list, 'is_public', 'isPublic')),
      doubleOptIn: boolean(value(list, 'double_opt_in', 'doubleOptIn')),
      subscriberCount: subscribed + pending,
      activeCount: subscribed,
      unsubscribedCount: membership.unsubscribed || 0,
      bouncedCount: membership.bounced || 0,
      storedSubscriberCount,
      countDrift: storedSubscriberCount !== subscribed + pending,
      campaignCount: campaign?.count || 0,
      lastSentAt: campaign?.lastSentAt || '',
      createdAt: text(value(list, 'created_at', 'createdAt')),
    }
  })

  return {
    records,
    summary: {
      total: records.length,
      active: records.filter(record => record.status === 'active').length,
      subscribers: records.reduce((sum, record) => sum + record.subscriberCount, 0),
      newThisWeek: [...newMemberships.values()].reduce((sum, count) => sum + count, 0),
      campaigns: records.reduce((sum, record) => sum + record.campaignCount, 0),
      counterDriftLists: records.filter(record => record.countDrift).length,
    },
  }
}

export function slugifyMarketingList(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function marketingListWriteData(input: Record<string, unknown>): {
  name: string
  slug: string
  description: string
  status: MarketingListStatus
  isPublic: number
  doubleOptIn: number
} {
  const name = text(input.name).trim()
  const slug = slugifyMarketingList(text(input.slug).trim() || name)
  return {
    name,
    slug,
    description: text(input.description).trim(),
    status: status(input.status),
    isPublic: boolean(input.isPublic ?? input.is_public) ? 1 : 0,
    doubleOptIn: boolean(input.doubleOptIn ?? input.double_opt_in) ? 1 : 0,
  }
}
