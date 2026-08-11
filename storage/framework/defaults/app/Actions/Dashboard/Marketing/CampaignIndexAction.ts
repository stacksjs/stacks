import { Action } from '@stacksjs/actions'
import { config } from '@stacksjs/config'
import { db } from '@stacksjs/database'
import { Campaign, EmailList } from '@stacksjs/orm'
import { dashboardOperationalError } from '../dashboard-response'
import { normalizeCampaigns } from './campaign-records'

export default new Action({
  name: 'CampaignIndexAction',
  description: 'Returns persisted campaigns with list membership and delivery aggregates.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const [
        campaigns,
        lists,
        membershipRows,
        sendRows,
        openedRows,
        clickedRows,
      ] = await Promise.all([
        Campaign.orderByDesc('id').limit(500).get(),
        EmailList.orderBy('name', 'asc').get(),
        db
          .selectFrom('email_list_subscribers')
          .select(['email_list_id', db.fn.count('id').as('count')])
          .where('status', '=', 'subscribed')
          .groupBy('email_list_id')
          .execute(),
        db
          .selectFrom('campaign_sends')
          .select(['campaign_id', 'status', db.fn.count('id').as('count')])
          .groupBy(['campaign_id', 'status'])
          .execute(),
        db
          .selectFrom('campaign_sends')
          .select(['campaign_id', db.fn.count('id').as('count')])
          .whereNotNull('opened_at')
          .groupBy('campaign_id')
          .execute(),
        db
          .selectFrom('campaign_sends')
          .select(['campaign_id', db.fn.count('id').as('count')])
          .whereNotNull('clicked_at')
          .groupBy('campaign_id')
          .execute(),
      ])

      return normalizeCampaigns(
        campaigns,
        lists,
        membershipRows,
        sendRows,
        openedRows,
        clickedRows,
        String((config as any).commerce?.currency || 'USD').toUpperCase(),
      )
    }
    catch (error) {
      return dashboardOperationalError(error, 'Campaigns could not be loaded.', 'CampaignIndexAction')
    }
  },
})
