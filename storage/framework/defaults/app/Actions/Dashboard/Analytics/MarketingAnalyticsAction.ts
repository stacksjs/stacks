import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { Campaign } from '@stacksjs/orm'
import { buildCampaignAnalytics } from './campaign-analytics'
import { normalizeAnalyticsRange } from './request-analytics'

export default new Action({
  name: 'MarketingAnalyticsAction',
  description: 'Returns campaign delivery, engagement, channel, and currency-safe spend analytics.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const range = normalizeAnalyticsRange(request.get('range'))
    const campaigns = await Campaign.orderByDesc('id').limit(10_000).get()

    return buildCampaignAnalytics(
      campaigns.map(campaign => ({
        id: String(campaign.get('id') || ''),
        name: String(campaign.get('name') || 'Untitled campaign'),
        type: String(campaign.get('type') || 'unknown'),
        status: String(campaign.get('status') || 'unknown'),
        audienceSize: Number(campaign.get('audience_size') || 0),
        sentCount: Number(campaign.get('sent_count') || 0),
        openRate: Number(campaign.get('open_rate') || 0),
        clickRate: Number(campaign.get('click_rate') || 0),
        conversionRate: Number(campaign.get('conversion_rate') || 0),
        budget: Number(campaign.get('budget') || 0),
        spent: Number(campaign.get('spent') || 0),
        currency: String(campaign.get('currency') || 'USD'),
        createdAt: String(campaign.get('created_at') || ''),
      })),
      range,
    )
  },
})
