import { Action } from '@stacksjs/actions'
import { Campaign } from '@stacksjs/orm'

export default new Action({
  name: 'CampaignIndexAction',
  description: 'Returns marketing campaign data for the dashboard.',
  method: 'GET',
  async handle() {
    const items = await Campaign.orderBy('created_at', 'desc').limit(50).get()
    const count = await Campaign.count()

    const stats = [
      { label: 'Active Campaigns', value: String(count) },
      { label: 'Total Sent', value: '-' },
      { label: 'Avg Open Rate', value: '-' },
      { label: 'Revenue Generated', value: '-' },
    ]

    return {
      campaigns: items.map(i => i.toJSON()),
      stats,
    }
  },
})
