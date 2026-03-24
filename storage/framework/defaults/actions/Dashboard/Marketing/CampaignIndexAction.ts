import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'CampaignIndexAction',
  description: 'Returns marketing campaign data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      data: [
        { id: 1, name: 'Spring Newsletter', type: 'email', status: 'sent', recipients: 5432, openRate: '35.2%', clickRate: '8.7%', sentAt: '2024-03-15' },
        { id: 2, name: 'Product Launch', type: 'email', status: 'draft', recipients: 0, openRate: '-', clickRate: '-', sentAt: null },
        { id: 3, name: 'Holiday Sale', type: 'email', status: 'scheduled', recipients: 8900, openRate: '-', clickRate: '-', sentAt: '2024-12-20' },
      ],
    }
  },
})
