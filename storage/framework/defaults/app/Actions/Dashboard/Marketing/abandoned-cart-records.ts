/**
 * Abandoned carts, and the campaign that goes after them.
 *
 * A cart that was filled and never checked out is the most qualified audience
 * a shop has: somebody chose the products, priced them, and stopped. Every
 * other campaign starts by guessing what a person wants; this one already
 * knows, and the only question is whether anybody asks them to come back.
 *
 * The Campaign model already carries everything a recovery campaign needs -
 * a channel, a schedule, delivery aggregates - so this does not add a second
 * kind of campaign beside it. What makes a campaign a recovery campaign is
 * its `segment_definition`: the column exists to say who a campaign is for,
 * and a recovery campaign is one that says "the people whose carts went cold".
 * Read `isRecoverySegment` as the whole of that contract.
 *
 * Nothing here writes. The functions are pure so the numbers on the dashboard
 * can be tested without a database, which is the only way the attribution
 * below is checkable at all.
 */

export type AbandonedCartState = 'abandoned' | 'expired' | 'recovered'

/** The marker that makes a Campaign a cart-recovery campaign. */
export const ABANDONED_CART_TRIGGER = 'abandoned_cart'

/** How long a cart sits untouched before it is worth chasing, in hours. */
export const DEFAULT_IDLE_HOURS = 4

export interface AbandonedCartRecord {
  id: string
  customerId: string
  customerName: string
  customerEmail: string
  itemCount: number
  /** The first few product names, for a row that says what was left behind. */
  items: string[]
  value: number
  currency: string
  abandonedAt: string
  /** Hours since the cart was last touched. */
  idleHours: number
  state: AbandonedCartState
  /** Whether a recovery campaign has already written to this customer. */
  contacted: boolean
  contactedAt: string
}

export interface AbandonedCartSummary {
  /** Carts sitting abandoned or expired right now. */
  open: number
  /** What those carts are worth. */
  openValue: number
  /** Of those, how many have already been written to. */
  contacted: number
  /** Carts that were contacted and then checked out. */
  recovered: number
  recoveredValue: number
  /** Recovered as a share of everything that was ever chased. */
  recoveryRate: number
  averageValue: number
  currency: string
}

export interface RecoveryCampaignRecord {
  id: string
  name: string
  status: string
  idleHours: number
  minimumValue: number
  sentCount: number
  openedCount: number
  clickedCount: number
  scheduledAt: string
  sentAt: string
}

export interface AbandonedCartIndexPayload {
  records: AbandonedCartRecord[]
  summary: AbandonedCartSummary
  campaigns: RecoveryCampaignRecord[]
  defaultCurrency: string
  defaultIdleHours: number
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

/**
 * A timestamp as milliseconds, whichever way the driver spelled it.
 *
 * SQLite hands back `2026-09-01 18:04:00` and Postgres an ISO string; both
 * have to compare against `Date.now()` or the idle hours on every row are
 * NaN, and a NaN sorts first, which puts the least useful rows at the top.
 *
 * A stamp with no zone on it is read as UTC, because that is what wrote it:
 * SQLite's CURRENT_TIMESTAMP is UTC and every driver here stores UTC. Left to
 * `new Date()`, a bare `2026-09-01 18:04:00` is read as local instead, and a
 * cart abandoned two hours ago in a UTC-7 browser comes back five hours in
 * the future - which clamps to "idle 0h" and quietly empties every filter
 * that asks for carts older than something.
 */
function moment(input: unknown): number {
  if (!input)
    return Number.NaN
  if (input instanceof Date)
    return input.getTime()

  const stamp = text(input).trim().replace(' ', 'T')
  const zoned = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(stamp) ? stamp : `${stamp}Z`
  const parsed = new Date(zoned).getTime()

  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function hoursBetween(from: number, to: number): number {
  if (!Number.isFinite(from) || !Number.isFinite(to))
    return 0
  return Math.max(0, Math.round((to - from) / 36e5 * 10) / 10)
}

/**
 * The audience a recovery campaign is written for.
 *
 * Stored on the campaign rather than recomputed from one, so a campaign that
 * was sent last month still says what it was aimed at even after the carts it
 * targeted have converted, expired, or been swept.
 */
export function abandonedCartSegment(idleHours: number, minimumValue: number): {
  trigger: string
  operator: string
  rules: Array<{ field: string, operator: string, value: unknown }>
} {
  return {
    trigger: ABANDONED_CART_TRIGGER,
    operator: 'and',
    rules: [
      { field: 'cart.state', operator: 'is', value: 'abandoned' },
      { field: 'cart.idleHours', operator: 'gte', value: Math.max(1, Math.round(idleHours) || DEFAULT_IDLE_HOURS) },
      { field: 'cart.value', operator: 'gte', value: Math.max(0, minimumValue) },
    ],
  }
}

/** Whether a stored `segment_definition` describes a cart-recovery audience. */
export function isRecoverySegment(input: unknown): boolean {
  const parsed = parseSegment(input)
  return parsed?.trigger === ABANDONED_CART_TRIGGER
}

function parseSegment(input: unknown): Record<string, any> | null {
  if (!input)
    return null
  if (typeof input === 'object')
    return input as Record<string, any>
  try {
    const parsed = JSON.parse(text(input))
    return parsed && typeof parsed === 'object' ? parsed : null
  }
  catch {
    // A segment nobody can parse is a segment nobody can be sure of, and
    // guessing here would silently widen who a campaign is sent to.
    return null
  }
}

function ruleValue(segment: Record<string, any> | null, field: string, fallback: number): number {
  const rules = Array.isArray(segment?.rules) ? segment!.rules : []
  const rule = rules.find((candidate: any) => candidate?.field === field)
  const found = Number(rule?.value)
  return Number.isFinite(found) ? found : fallback
}

function groupItems(itemRows: any[]): Map<string, { count: number, names: string[] }> {
  const grouped = new Map<string, { count: number, names: string[] }>()
  for (const row of itemRows) {
    const cartId = text(value(row, 'cart_id', 'cartId'))
    if (!cartId)
      continue
    const current = grouped.get(cartId) || { count: 0, names: [] }
    current.count += Math.max(1, number(value(row, 'quantity')) || 1)
    const name = text(value(row, 'product_name', 'productName'))
    if (name && current.names.length < 4)
      current.names.push(name)
    grouped.set(cartId, current)
  }
  return grouped
}

/**
 * Who a recovery campaign has already written to, and when it first did.
 *
 * Keyed by the address rather than by a subscriber id: a campaign send records
 * the recipient it actually wrote to, and that address is the only thing a
 * cart's customer and a campaign's send have in common.
 */
function contactedRecipients(sendRows: any[], recoveryCampaignIds: Set<string>): Map<string, number> {
  const contacted = new Map<string, number>()
  for (const row of sendRows) {
    if (!recoveryCampaignIds.has(text(value(row, 'campaign_id', 'campaignId'))))
      continue
    const recipient = text(value(row, 'recipient')).toLowerCase()
    if (!recipient)
      continue
    const sentAt = moment(value(row, 'sent_at', 'sentAt') ?? value(row, 'created_at', 'createdAt'))
    if (!Number.isFinite(sentAt))
      continue
    const existing = contacted.get(recipient)
    if (existing === undefined || sentAt < existing)
      contacted.set(recipient, sentAt)
  }
  return contacted
}

export function normalizeAbandonedCarts(
  cartRows: any[],
  itemRows: any[],
  customerRows: any[],
  campaignRows: any[],
  sendRows: any[],
  options: { defaultCurrency?: string, now?: Date, idleHours?: number } = {},
): AbandonedCartIndexPayload {
  const defaultCurrency = (options.defaultCurrency || 'USD').toUpperCase()
  const now = (options.now ?? new Date()).getTime()
  const defaultIdleHours = Math.max(1, Math.round(options.idleHours ?? DEFAULT_IDLE_HOURS))

  const customers = new Map(customerRows.map(row => [text(value(row, 'id')), row]))
  const items = groupItems(itemRows)

  const campaigns = campaignRows
    .filter(row => isRecoverySegment(value(row, 'segment_definition', 'segmentDefinition')))
    .map((row): RecoveryCampaignRecord => {
      const segment = parseSegment(value(row, 'segment_definition', 'segmentDefinition'))
      return {
        id: text(value(row, 'id')),
        name: text(value(row, 'name')),
        status: text(value(row, 'status')) || 'draft',
        idleHours: ruleValue(segment, 'cart.idleHours', defaultIdleHours),
        minimumValue: ruleValue(segment, 'cart.value', 0),
        sentCount: number(value(row, 'sent_count', 'sentCount')),
        openedCount: number(value(row, 'opened_count', 'openedCount')),
        clickedCount: number(value(row, 'clicked_count', 'clickedCount')),
        scheduledAt: text(value(row, 'scheduled_at', 'scheduledAt')),
        sentAt: text(value(row, 'sent_at', 'sentAt')),
      }
    })

  const contacted = contactedRecipients(sendRows, new Set(campaigns.map(campaign => campaign.id)))

  const records = cartRows.map((cart): AbandonedCartRecord => {
    const id = text(value(cart, 'id'))
    const customerId = text(value(cart, 'customer_id', 'customerId'))
    const customer = customers.get(customerId)
    const email = text(value(customer, 'email'))
    const status = text(value(cart, 'status')).toLowerCase()
    const abandonedAtMs = moment(value(cart, 'updated_at', 'updatedAt') ?? value(cart, 'created_at', 'createdAt'))
    const contactedAtMs = contacted.get(email.toLowerCase())
    const grouped = items.get(id)

    /*
     * `converted` is only counted as recovered when a recovery campaign got
     * there first. A cart somebody came back to on their own is a sale, not a
     * campaign's, and crediting it would make every recovery campaign look
     * like it worked.
     */
    const recovered = status === 'converted'
      && contactedAtMs !== undefined
      && Number.isFinite(abandonedAtMs)
      && contactedAtMs <= abandonedAtMs

    return {
      id,
      customerId,
      customerName: text(value(customer, 'name')) || 'Guest',
      customerEmail: email,
      itemCount: grouped?.count || number(value(cart, 'total_items', 'totalItems')),
      items: grouped?.names || [],
      value: number(value(cart, 'total')),
      currency: text(value(cart, 'currency')).toUpperCase() || defaultCurrency,
      abandonedAt: text(value(cart, 'updated_at', 'updatedAt') ?? value(cart, 'created_at', 'createdAt')),
      idleHours: hoursBetween(abandonedAtMs, now),
      state: recovered ? 'recovered' : status === 'expired' ? 'expired' : 'abandoned',
      contacted: contactedAtMs !== undefined,
      contactedAt: contactedAtMs === undefined ? '' : new Date(contactedAtMs).toISOString(),
    }
  })

  const open = records.filter(record => record.state !== 'recovered')
  const recovered = records.filter(record => record.state === 'recovered')
  const openValue = open.reduce((sum, record) => sum + record.value, 0)
  const recoveredValue = recovered.reduce((sum, record) => sum + record.value, 0)
  const chased = open.filter(record => record.contacted).length + recovered.length

  return {
    records,
    summary: {
      open: open.length,
      openValue,
      contacted: open.filter(record => record.contacted).length,
      recovered: recovered.length,
      recoveredValue,
      recoveryRate: chased > 0 ? recovered.length / chased * 100 : 0,
      averageValue: open.length > 0 ? openValue / open.length : 0,
      currency: records[0]?.currency || defaultCurrency,
    },
    campaigns,
    defaultCurrency,
    defaultIdleHours,
  }
}

/**
 * How many carts a campaign with these rules would be written for, and what
 * they are worth. Shown on the compose dialog so nobody schedules a send to
 * nobody, or to everybody.
 */
export function reachOf(
  records: AbandonedCartRecord[],
  idleHours: number,
  minimumValue: number,
): { carts: number, value: number } {
  const matching = records.filter(record =>
    record.state === 'abandoned'
    && record.customerEmail !== ''
    && record.idleHours >= idleHours
    && record.value >= minimumValue)

  return {
    carts: matching.length,
    value: matching.reduce((sum, record) => sum + record.value, 0),
  }
}

export interface RecoveryCampaignInput {
  name: string
  subject: string
  template: string
  text: string
  fromName: string
  fromAddress: string
  emailListId: number | null
  idleHours: number
  minimumValue: number
  scheduledAt: string | null
  currency: string
}

export function recoveryCampaignWriteData(
  input: Record<string, unknown>,
  defaultCurrency = 'USD',
): {
  name: string
  description: string
  type: 'email'
  status: 'draft' | 'scheduled'
  subject: string
  template: string
  text: string | null
  from_name: string | null
  from_address: string | null
  email_list_id: number | null
  segment_definition: string
  scheduled_at: string | null
  currency: string
} {
  const idleHours = Math.max(1, Math.round(Number(input.idleHours)) || DEFAULT_IDLE_HOURS)
  const minimumValue = Math.max(0, Number(input.minimumValue) || 0)
  const emailListId = Number(input.emailListId ?? input.email_list_id)
  const scheduledAt = text(input.scheduledAt ?? input.scheduled_at).trim()

  return {
    name: text(input.name).trim(),
    description: `Recovery campaign for carts idle ${idleHours}h or more.`,
    type: 'email',
    status: scheduledAt ? 'scheduled' : 'draft',
    subject: text(input.subject).trim(),
    template: text(input.template).trim() || 'abandoned-cart',
    text: text(input.text).trim() || null,
    from_name: text(input.fromName ?? input.from_name).trim() || null,
    from_address: text(input.fromAddress ?? input.from_address).trim() || null,
    email_list_id: Number.isInteger(emailListId) && emailListId > 0 ? emailListId : null,
    segment_definition: JSON.stringify(abandonedCartSegment(idleHours, minimumValue)),
    scheduled_at: scheduledAt || null,
    currency: text(input.currency).trim().toUpperCase() || defaultCurrency,
  }
}

export function validateRecoveryCampaign(
  data: ReturnType<typeof recoveryCampaignWriteData>,
  now = new Date(),
): string {
  if (data.name.trim().length < 3)
    return 'Recovery campaign names must contain at least 3 characters.'
  if (!data.subject)
    return 'A recovery campaign needs a subject line.'

  /*
   * The whole point of this campaign is that it writes to people who left a
   * cart, and the address it writes to comes from the cart's customer. A
   * campaign aimed at an email list would write to the list instead, which is
   * a newsletter with a misleading name.
   */
  if (data.email_list_id)
    return 'Recovery campaigns take their audience from abandoned carts, not from an email list.'

  if (data.status === 'scheduled') {
    const scheduledAt = new Date(String(data.scheduled_at).replace(' ', 'T')).getTime()
    if (!Number.isFinite(scheduledAt))
      return 'Enter a valid send time.'
    if (scheduledAt <= now.getTime())
      return 'A recovery campaign has to be scheduled for the future.'
  }

  return ''
}
