import type { AnalyticsRange } from './request-analytics'

export interface CampaignAnalyticsRow {
  id: string
  name: string
  type: string
  status: string
  audienceSize: number
  sentCount: number
  openRate: number
  clickRate: number
  conversionRate: number
  budget: number
  spent: number
  currency: string
  createdAt: string
}

const RANGE_DAYS: Record<AnalyticsRange, number> = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
}

function timestamp(value: string): number {
  if (!value)
    return Number.NaN
  const normalized = /^\d{4}-\d{2}-\d{2} \d/.test(value)
    ? `${value.replace(' ', 'T')}Z`
    : value
  return new Date(normalized).getTime()
}

function normalizeCurrency(value: string): string {
  return value.trim().toUpperCase() || 'USD'
}

function titleCase(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
}

function weightedRate(rows: CampaignAnalyticsRow[], key: 'openRate' | 'clickRate' | 'conversionRate'): number {
  const sent = rows.reduce((sum, row) => sum + row.sentCount, 0)
  if (sent > 0)
    return Math.round((rows.reduce((sum, row) => sum + row[key] * row.sentCount, 0) / sent) * 10) / 10
  if (rows.length === 0)
    return 0
  return Math.round((rows.reduce((sum, row) => sum + row[key], 0) / rows.length) * 10) / 10
}

export function buildCampaignAnalytics(
  allCampaigns: CampaignAnalyticsRow[],
  range: AnalyticsRange,
  now = new Date(),
) {
  const start = new Date(now.getTime() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000)
  const campaigns = allCampaigns
    .filter(campaign => timestamp(campaign.createdAt) >= start.getTime() && timestamp(campaign.createdAt) <= now.getTime())
    .map(campaign => ({
      ...campaign,
      currency: normalizeCurrency(campaign.currency),
      opens: Math.round(campaign.sentCount * campaign.openRate / 100),
      clicks: Math.round(campaign.sentCount * campaign.clickRate / 100),
      conversions: Math.round(campaign.sentCount * campaign.conversionRate / 100),
    }))
    .sort((left, right) => right.sentCount - left.sentCount)

  const spendMap = new Map<string, { currency: string, budget: number, spent: number, campaigns: number }>()
  for (const campaign of campaigns) {
    const total = spendMap.get(campaign.currency) || { currency: campaign.currency, budget: 0, spent: 0, campaigns: 0 }
    total.budget += campaign.budget
    total.spent += campaign.spent
    total.campaigns++
    spendMap.set(campaign.currency, total)
  }

  const channelMap = new Map<string, CampaignAnalyticsRow[]>()
  for (const campaign of campaigns) {
    const key = `${campaign.type}:${campaign.currency}`
    const rows = channelMap.get(key) || []
    rows.push(campaign)
    channelMap.set(key, rows)
  }
  const channels = [...channelMap.entries()]
    .map(([key, rows]) => {
      const [type, currency] = key.split(':')
      return {
        type,
        name: titleCase(type),
        currency,
        campaigns: rows.length,
        audience: rows.reduce((sum, row) => sum + row.audienceSize, 0),
        sent: rows.reduce((sum, row) => sum + row.sentCount, 0),
        spent: rows.reduce((sum, row) => sum + row.spent, 0),
        openRate: weightedRate(rows, 'openRate'),
        clickRate: weightedRate(rows, 'clickRate'),
        conversionRate: weightedRate(rows, 'conversionRate'),
      }
    })
    .sort((left, right) =>
      right.sent - left.sent
      || left.name.localeCompare(right.name)
      || left.currency.localeCompare(right.currency),
    )

  const statusMap = new Map<string, number>()
  for (const campaign of campaigns)
    statusMap.set(campaign.status || 'unknown', (statusMap.get(campaign.status || 'unknown') || 0) + 1)

  return {
    source: 'campaigns' as const,
    range,
    dateRange: {
      start: start.toISOString(),
      end: now.toISOString(),
    },
    overview: {
      campaigns: campaigns.length,
      audience: campaigns.reduce((sum, campaign) => sum + campaign.audienceSize, 0),
      sent: campaigns.reduce((sum, campaign) => sum + campaign.sentCount, 0),
      opens: campaigns.reduce((sum, campaign) => sum + campaign.opens, 0),
      clicks: campaigns.reduce((sum, campaign) => sum + campaign.clicks, 0),
      conversions: campaigns.reduce((sum, campaign) => sum + campaign.conversions, 0),
      openRate: weightedRate(campaigns, 'openRate'),
      clickRate: weightedRate(campaigns, 'clickRate'),
      conversionRate: weightedRate(campaigns, 'conversionRate'),
    },
    spendByCurrency: [...spendMap.values()].sort((left, right) => right.spent - left.spent),
    campaigns,
    channels,
    statuses: [...statusMap.entries()]
      .map(([status, count]) => ({ status, label: titleCase(status), count }))
      .sort((left, right) => right.count - left.count),
  }
}
