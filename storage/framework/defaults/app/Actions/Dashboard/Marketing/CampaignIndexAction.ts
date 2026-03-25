import { Action } from '@stacksjs/actions'
import { Campaign } from '@stacksjs/orm'

export default new Action({
  name: 'CampaignIndexAction',
  description: 'Returns marketing campaign data for the dashboard.',
  method: 'GET',
  async handle() {
    try {
      const allCampaigns = await Campaign.orderByDesc('id').get()

      const campaigns = allCampaigns.map(c => ({
        name: String(c.get('name') || ''),
        type: String(c.get('type') || 'Email'),
        status: String(c.get('status') || 'active'),
        sent: String(c.get('sent_count') || c.get('sent') || '-'),
        opened: c.get('open_rate') ? `${c.get('open_rate')}%` : '-',
        clicked: c.get('click_rate') ? `${c.get('click_rate')}%` : '-',
        revenue: c.get('revenue') ? `$${c.get('revenue')}` : '-',
      }))

      const activeCampaigns = campaigns.filter(c => c.status === 'active').length

      const stats = [
        { label: 'Active Campaigns', value: String(activeCampaigns) },
        { label: 'Total Sent', value: '-' },
        { label: 'Avg Open Rate', value: '-' },
        { label: 'Revenue Generated', value: '-' },
      ]

      return { campaigns, stats }
    }
    catch {
      return {
        campaigns: [],
        stats: [
          { label: 'Active Campaigns', value: '0' },
          { label: 'Total Sent', value: '0' },
          { label: 'Avg Open Rate', value: '-' },
          { label: 'Revenue Generated', value: '-' },
        ],
      }
    }
  },
})
