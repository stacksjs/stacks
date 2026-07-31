import type { AnalyticsRange } from './request-analytics'

export interface CampaignAnalyticsRow {
  id: string
  name: string
  type: string
  status: string
  audienceSize: number | null
  sentCount: number | null
  openRate: number | null
  clickRate: number | null
  conversionRate: number | null
  budget: number | null
  spent: number | null
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

function completeSum(values: Array<number | null>): number | null {
  if (values.some(value => value === null))
    return null
  return values.reduce<number>((sum, value) => sum + (value as number), 0)
}

function derivedCount(sent: number | null, rate: number | null): number | null {
  if (sent === null)
    return null
  if (sent === 0)
    return 0
  return rate === null ? null : Math.round(sent * rate / 100)
}

function weightedRate(rows: CampaignAnalyticsRow[], key: 'openRate' | 'clickRate' | 'conversionRate'): number | null {
  if (rows.some(row => row.sentCount === null))
    return null

  const sentRows = rows.filter(row => (row.sentCount as number) > 0)
  if (sentRows.some(row => row[key] === null))
    return null

  const sent = sentRows.reduce((sum, row) => sum + (row.sentCount as number), 0)
  if (sent > 0) {
    const weighted = sentRows.reduce((sum, row) =>
      sum + (row[key] as number) * (row.sentCount as number), 0)
    return Math.round((weighted / sent) * 10) / 10
  }

  const recorded = rows
    .map(row => row[key])
    .filter((value): value is number => value !== null)
  if (recorded.length === 0)
    return null
  return Math.round((recorded.reduce((sum, value) => sum + value, 0) / recorded.length) * 10) / 10
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
      opens: derivedCount(campaign.sentCount, campaign.openRate),
      clicks: derivedCount(campaign.sentCount, campaign.clickRate),
      conversions: derivedCount(campaign.sentCount, campaign.conversionRate),
    }))
    .sort((left, right) => (right.sentCount ?? -1) - (left.sentCount ?? -1))

  const spendMap = new Map<string, { currency: string, budget: Array<number | null>, spent: Array<number | null>, campaigns: number }>()
  for (const campaign of campaigns) {
    const total = spendMap.get(campaign.currency) || { currency: campaign.currency, budget: [], spent: [], campaigns: 0 }
    total.budget.push(campaign.budget)
    total.spent.push(campaign.spent)
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
        audience: completeSum(rows.map(row => row.audienceSize)),
        sent: completeSum(rows.map(row => row.sentCount)),
        spent: completeSum(rows.map(row => row.spent)),
        openRate: weightedRate(rows, 'openRate'),
        clickRate: weightedRate(rows, 'clickRate'),
        conversionRate: weightedRate(rows, 'conversionRate'),
      }
    })
    .sort((left, right) =>
      (right.sent ?? -1) - (left.sent ?? -1)
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
      audience: completeSum(campaigns.map(campaign => campaign.audienceSize)),
      sent: completeSum(campaigns.map(campaign => campaign.sentCount)),
      opens: completeSum(campaigns.map(campaign => campaign.opens)),
      clicks: completeSum(campaigns.map(campaign => campaign.clicks)),
      conversions: completeSum(campaigns.map(campaign => campaign.conversions)),
      openRate: weightedRate(campaigns, 'openRate'),
      clickRate: weightedRate(campaigns, 'clickRate'),
      conversionRate: weightedRate(campaigns, 'conversionRate'),
    },
    spendByCurrency: [...spendMap.values()]
      .map(total => ({
        currency: total.currency,
        budget: completeSum(total.budget),
        spent: completeSum(total.spent),
        campaigns: total.campaigns,
      }))
      .sort((left, right) => (right.spent ?? -1) - (left.spent ?? -1)),
    campaigns,
    channels,
    statuses: [...statusMap.entries()]
      .map(([status, count]) => ({ status, label: titleCase(status), count }))
      .sort((left, right) => right.count - left.count),
  }
}
