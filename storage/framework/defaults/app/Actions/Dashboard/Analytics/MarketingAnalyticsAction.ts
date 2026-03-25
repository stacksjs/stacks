import { Action } from '@stacksjs/actions'

// TODO: integrate with analytics provider (Fathom/Plausible)
export default new Action({
  name: 'MarketingAnalyticsAction',
  description: 'Returns marketing analytics data for the dashboard.',
  method: 'GET',
  async handle() {
    const stats = [
      { label: 'Campaign ROI', value: '324%', change: '+45%' },
      { label: 'Lead Acquisition', value: '2,345', change: '+18%' },
      { label: 'Cost per Lead', value: '$12.34', change: '-8%' },
      { label: 'Email Open Rate', value: '28.5%', change: '+3.2%' },
    ]

    const campaigns = [
      { name: 'Spring Sale 2024', spend: '$5,678', leads: 456, cpl: '$12.45', revenue: '$23,456', roi: '313%' },
      { name: 'Product Launch', spend: '$3,456', leads: 234, cpl: '$14.77', revenue: '$15,678', roi: '354%' },
      { name: 'Retargeting', spend: '$2,345', leads: 189, cpl: '$12.41', revenue: '$12,345', roi: '426%' },
      { name: 'Content Marketing', spend: '$1,234', leads: 567, cpl: '$2.18', revenue: '$8,765', roi: '610%' },
      { name: 'Social Ads', spend: '$4,567', leads: 345, cpl: '$13.24', revenue: '$18,234', roi: '299%' },
    ]

    const channels = [
      { channel: 'Paid Search', spend: '$12,345', leads: 890, conversion: '4.2%' },
      { channel: 'Social Media', spend: '$8,765', leads: 567, conversion: '3.1%' },
      { channel: 'Email', spend: '$2,345', leads: 456, conversion: '8.5%' },
      { channel: 'Content', spend: '$1,234', leads: 789, conversion: '2.8%' },
      { channel: 'Referral', spend: '$567', leads: 234, conversion: '12.3%' },
    ]

    const attribution = [
      { source: 'First Touch', leads: 1234, percentage: 52.6 },
      { source: 'Last Touch', leads: 890, percentage: 37.9 },
      { source: 'Linear', leads: 221, percentage: 9.5 },
    ]

    return {
      stats,
      campaigns,
      channels,
      attribution,
    }
  },
})
