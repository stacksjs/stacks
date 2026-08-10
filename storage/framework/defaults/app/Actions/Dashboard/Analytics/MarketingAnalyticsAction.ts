import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { Campaign } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import {
  analyticsCurrency,
  analyticsIdentifier,
  analyticsOptionalNumber,
  analyticsString,
  analyticsTimestamp,
} from './analytics-record'
import { buildCampaignAnalytics } from './campaign-analytics'
import { normalizeAnalyticsRange } from './request-analytics'

export default new Action({
  name: 'MarketingAnalyticsAction',
  description: 'Returns campaign delivery, engagement, channel, and currency-safe spend analytics.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    let range
    try {
      range = normalizeAnalyticsRange(request.get('range'))
    }
    catch (error) {
      return response.json({
        message: error instanceof Error ? error.message : 'The analytics query is invalid.',
      }, 422)
    }
    try {
      const campaigns = await Campaign.orderByDesc('id').limit(10_000).get()

      return buildCampaignAnalytics(
        campaigns.map((campaign) => {
          const id = analyticsIdentifier(campaign.get('id'), 'Campaign')
          const source = `Campaign ${id}`
          return {
            id,
            name: analyticsString(campaign.get('name'), source, 'name'),
            type: analyticsString(campaign.get('type'), source, 'type'),
            status: analyticsString(campaign.get('status'), source, 'status'),
            audienceSize: analyticsOptionalNumber(campaign.get('audience_size'), source, 'audience_size', { min: 0, integer: true }),
            sentCount: analyticsOptionalNumber(campaign.get('sent_count'), source, 'sent_count', { min: 0, integer: true }),
            openRate: analyticsOptionalNumber(campaign.get('open_rate'), source, 'open_rate', { min: 0, max: 100 }),
            clickRate: analyticsOptionalNumber(campaign.get('click_rate'), source, 'click_rate', { min: 0, max: 100 }),
            conversionRate: analyticsOptionalNumber(campaign.get('conversion_rate'), source, 'conversion_rate', { min: 0, max: 100 }),
            budget: analyticsOptionalNumber(campaign.get('budget'), source, 'budget', { min: 0 }),
            spent: analyticsOptionalNumber(campaign.get('spent'), source, 'spent', { min: 0 }),
            currency: analyticsCurrency(campaign.get('currency'), source),
            createdAt: analyticsTimestamp(campaign.get('created_at'), source),
          }
        }),
        range,
      )
    }
    catch (error) {
      return dashboardOperationalError(error, 'Campaign analytics records could not be read.', 'MarketingAnalyticsAction')
    }
  },
})
