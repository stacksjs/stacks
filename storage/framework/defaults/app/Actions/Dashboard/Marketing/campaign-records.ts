export type CampaignType = 'email' | 'sms' | 'push' | 'social' | 'multi-channel'
export type CampaignStatus
  = | 'draft'
    | 'scheduled'
    | 'sending'
    | 'sent'
    | 'paused'
    | 'cancelled'
    | 'failed'
    | 'active'
    | 'completed'
    | 'archived'

export interface CampaignListOption {
  id: string
  name: string
  status: string
  activeMembers: number
}

export interface CampaignRecord {
  id: string
  name: string
  description: string
  type: CampaignType
  status: CampaignStatus
  subject: string
  template: string
  text: string
  fromName: string
  fromAddress: string
  emailListId: string
  emailListName: string
  scheduledAt: string
  sentAt: string
  audienceSize: number
  sentCount: number
  queuedCount: number
  failedCount: number
  bouncedCount: number
  complainedCount: number
  openedCount: number
  clickedCount: number
  openRate: number
  clickRate: number
  conversionRate: number
  budget: number
  spent: number
  currency: string
  startDate: string
  endDate: string
  createdAt: string
}

export interface CampaignSummary {
  total: number
  live: number
  sent: number
  recipients: number
  failedDeliveries: number
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

function campaignType(input: unknown): CampaignType {
  const normalized = text(input).toLowerCase()
  return ['email', 'sms', 'push', 'social', 'multi-channel'].includes(normalized)
    ? normalized as CampaignType
    : 'email'
}

function campaignStatus(input: unknown): CampaignStatus {
  const normalized = text(input).toLowerCase()
  return [
    'draft',
    'scheduled',
    'sending',
    'sent',
    'paused',
    'cancelled',
    'failed',
    'active',
    'completed',
    'archived',
  ].includes(normalized)
    ? normalized as CampaignStatus
    : 'draft'
}

function groupedCounts(rows: any[], idKey: string): Map<string, Record<string, number>> {
  const grouped = new Map<string, Record<string, number>>()
  for (const row of rows) {
    const id = text(value(row, idKey))
    const status = text(value(row, 'status')).toLowerCase()
    if (!id || !status)
      continue
    const current = grouped.get(id) || {}
    current[status] = number(value(row, 'count'))
    grouped.set(id, current)
  }
  return grouped
}

function countMap(rows: any[], idKey: string): Map<string, number> {
  return new Map(rows.map(row => [
    text(value(row, idKey)),
    number(value(row, 'count')),
  ]))
}

export function normalizeCampaigns(
  campaignRows: any[],
  listRows: any[],
  membershipRows: any[],
  sendRows: any[],
  openedRows: any[],
  clickedRows: any[],
  defaultCurrency = 'USD',
): { records: CampaignRecord[], summary: CampaignSummary, lists: CampaignListOption[], defaultCurrency: string } {
  const activeMembers = countMap(membershipRows, 'email_list_id')
  const lists = listRows.map((list): CampaignListOption => {
    const id = text(value(list, 'id'))
    return {
      id,
      name: text(value(list, 'name')),
      status: text(value(list, 'status')),
      activeMembers: activeMembers.get(id) || 0,
    }
  })
  const listsById = new Map(lists.map(list => [list.id, list]))
  const sends = groupedCounts(sendRows, 'campaign_id')
  const opens = countMap(openedRows, 'campaign_id')
  const clicks = countMap(clickedRows, 'campaign_id')

  const records = campaignRows.map((campaign): CampaignRecord => {
    const id = text(value(campaign, 'id'))
    const emailListId = text(value(campaign, 'email_list_id', 'emailListId'))
    const delivery = sends.get(id) || {}
    const sentCount = delivery.sent || number(value(campaign, 'sent_count', 'sentCount'))
    const openedCount = opens.get(id) || 0
    const clickedCount = clicks.get(id) || 0
    const list = listsById.get(emailListId)
    return {
      id,
      name: text(value(campaign, 'name')),
      description: text(value(campaign, 'description')),
      type: campaignType(value(campaign, 'type')),
      status: campaignStatus(value(campaign, 'status')),
      subject: text(value(campaign, 'subject')),
      template: text(value(campaign, 'template')),
      text: text(value(campaign, 'text')),
      fromName: text(value(campaign, 'from_name', 'fromName')),
      fromAddress: text(value(campaign, 'from_address', 'fromAddress')),
      emailListId,
      emailListName: list?.name || (emailListId ? `Email list ${emailListId}` : 'Not assigned'),
      scheduledAt: text(value(campaign, 'scheduled_at', 'scheduledAt')),
      sentAt: text(value(campaign, 'sent_at', 'sentAt')),
      audienceSize: list?.activeMembers || number(value(campaign, 'audience_size', 'audienceSize')),
      sentCount,
      queuedCount: delivery.queued || 0,
      failedCount: delivery.failed || 0,
      bouncedCount: delivery.bounced || 0,
      complainedCount: delivery.complained || 0,
      openedCount,
      clickedCount,
      openRate: sentCount > 0 ? openedCount / sentCount * 100 : number(value(campaign, 'open_rate', 'openRate')),
      clickRate: sentCount > 0 ? clickedCount / sentCount * 100 : number(value(campaign, 'click_rate', 'clickRate')),
      conversionRate: number(value(campaign, 'conversion_rate', 'conversionRate')),
      budget: number(value(campaign, 'budget')),
      spent: number(value(campaign, 'spent')),
      currency: text(value(campaign, 'currency')).toUpperCase() || defaultCurrency,
      startDate: text(value(campaign, 'start_date', 'startDate')),
      endDate: text(value(campaign, 'end_date', 'endDate')),
      createdAt: text(value(campaign, 'created_at', 'createdAt')),
    }
  })

  return {
    records,
    summary: {
      total: records.length,
      live: records.filter(record => ['scheduled', 'sending', 'active'].includes(record.status)).length,
      sent: records.filter(record => ['sent', 'completed'].includes(record.status)).length,
      recipients: records.reduce((sum, record) => sum + record.sentCount, 0),
      failedDeliveries: records.reduce((sum, record) => sum + record.failedCount + record.bouncedCount + record.complainedCount, 0),
    },
    lists,
    defaultCurrency,
  }
}

export function campaignWriteData(input: Record<string, unknown>, defaultCurrency = 'USD'): {
  name: string
  description: string | null
  type: CampaignType
  status: CampaignStatus
  subject: string | null
  template: string | null
  text: string | null
  from_name: string | null
  from_address: string | null
  email_list_id: number | null
  scheduled_at: string | null
  budget: number | null
  spent: number
  currency: string
  start_date: string | null
  end_date: string | null
} {
  const emailListId = Number(input.emailListId ?? input.email_list_id)
  const budget = text(input.budget).trim()
  const spent = Number(input.spent)
  return {
    name: text(input.name).trim(),
    description: text(input.description).trim() || null,
    type: campaignType(input.type),
    status: campaignStatus(input.status),
    subject: text(input.subject).trim() || null,
    template: text(input.template).trim() || null,
    text: text(input.text).trim() || null,
    from_name: text(input.fromName ?? input.from_name).trim() || null,
    from_address: text(input.fromAddress ?? input.from_address).trim() || null,
    email_list_id: Number.isInteger(emailListId) && emailListId > 0 ? emailListId : null,
    scheduled_at: text(input.scheduledAt ?? input.scheduled_at).trim() || null,
    budget: budget ? Math.max(0, Number(budget) || 0) : null,
    spent: Number.isFinite(spent) ? Math.max(0, spent) : 0,
    currency: text(input.currency).trim().toUpperCase() || defaultCurrency,
    start_date: text(input.startDate ?? input.start_date).trim() || null,
    end_date: text(input.endDate ?? input.end_date).trim() || null,
  }
}

export function validateCampaignWriteData(
  data: ReturnType<typeof campaignWriteData>,
  now = new Date(),
): string {
  if (data.name.length < 3)
    return 'Campaign names must contain at least 3 characters.'
  if (data.type === 'email' && !data.email_list_id)
    return 'Email campaigns require an email list.'
  if (data.type === 'email' && !data.subject)
    return 'Email campaigns require a subject.'
  if (data.type === 'email' && !data.template)
    return 'Email campaigns require a template name or raw HTML.'
  if (data.status === 'scheduled') {
    if (!data.scheduled_at)
      return 'Scheduled campaigns require a schedule time.'
    const scheduledAt = new Date(data.scheduled_at.replace(' ', 'T')).getTime()
    if (!Number.isFinite(scheduledAt))
      return 'Enter a valid campaign schedule time.'
    if (scheduledAt <= now.getTime())
      return 'Campaign schedule time must be in the future.'
  }
  if (data.start_date && data.end_date) {
    const startsAt = new Date(data.start_date.replace(' ', 'T')).getTime()
    const endsAt = new Date(data.end_date.replace(' ', 'T')).getTime()
    if (Number.isFinite(startsAt) && Number.isFinite(endsAt) && endsAt < startsAt)
      return 'Campaign end time must be after its start time.'
  }
  return ''
}
