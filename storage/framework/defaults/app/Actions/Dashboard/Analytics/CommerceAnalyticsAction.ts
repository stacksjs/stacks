import { Action } from '@stacksjs/actions'

// TODO: integrate with analytics provider (Fathom/Plausible)
export default new Action({
  name: 'CommerceAnalyticsAction',
  description: 'Returns commerce analytics data for the dashboard.',
  method: 'GET',
  async handle() {
    const stats = [
      { label: 'Total Revenue', value: '$145,678', change: '+18.5%' },
      { label: 'Orders', value: '2,345', change: '+12.3%' },
      { label: 'Avg Order Value', value: '$62.12', change: '+5.2%' },
      { label: 'Conversion Rate', value: '3.4%', change: '+0.8%' },
    ]

    const topProducts = [
      { name: 'Premium Widget', revenue: '$23,456', units: 234, growth: '+15%' },
      { name: 'Pro Subscription', revenue: '$18,234', units: 182, growth: '+22%' },
      { name: 'Basic Package', revenue: '$12,345', units: 456, growth: '+8%' },
      { name: 'Starter Kit', revenue: '$8,765', units: 876, growth: '+12%' },
      { name: 'Enterprise Plan', revenue: '$45,678', units: 45, growth: '+35%' },
    ]

    const salesByRegion = [
      { region: 'North America', revenue: '$78,234', orders: 1234, percentage: 53.7 },
      { region: 'Europe', revenue: '$34,567', orders: 567, percentage: 23.7 },
      { region: 'Asia Pacific', revenue: '$23,456', orders: 345, percentage: 16.1 },
      { region: 'Rest of World', revenue: '$9,421', orders: 199, percentage: 6.5 },
    ]

    const revenueByChannel = [
      { channel: 'Website', revenue: '$89,234', percentage: 61.2 },
      { channel: 'Mobile App', revenue: '$34,567', percentage: 23.7 },
      { channel: 'API/Partners', revenue: '$21,877', percentage: 15.1 },
    ]

    return {
      stats,
      topProducts,
      salesByRegion,
      revenueByChannel,
    }
  },
})
