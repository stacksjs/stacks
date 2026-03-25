import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'WebAnalyticsAction',
  description: 'Returns web analytics data for the dashboard.',
  method: 'GET',
  async handle() {
    // TODO: replace with model query when available
    const stats = [
      { label: 'Page Views', value: '145,678', change: '+12.5%' },
      { label: 'Unique Visitors', value: '45,234', change: '+8.2%' },
      { label: 'Avg Session', value: '3m 24s', change: '+5.1%' },
      { label: 'Bounce Rate', value: '42.3%', change: '-2.1%' },
    ]

    const topPages = [
      { page: '/', title: 'Home', views: '23,456', unique: '18,234', avgTime: '45s' },
      { page: '/products', title: 'Products', views: '12,345', unique: '9,876', avgTime: '2m 12s' },
      { page: '/blog', title: 'Blog', views: '8,765', unique: '6,543', avgTime: '4m 32s' },
      { page: '/pricing', title: 'Pricing', views: '5,432', unique: '4,321', avgTime: '1m 45s' },
      { page: '/about', title: 'About Us', views: '3,210', unique: '2,345', avgTime: '1m 12s' },
    ]

    const sources = [
      { source: 'Google Search', visitors: '18,234', percentage: '40.3%' },
      { source: 'Direct', visitors: '12,345', percentage: '27.3%' },
      { source: 'Social Media', visitors: '8,765', percentage: '19.4%' },
      { source: 'Referrals', visitors: '4,321', percentage: '9.5%' },
      { source: 'Email', visitors: '1,569', percentage: '3.5%' },
    ]

    const devices = [
      { device: 'Desktop', percentage: 58 },
      { device: 'Mobile', percentage: 35 },
      { device: 'Tablet', percentage: 7 },
    ]

    return {
      stats,
      topPages,
      sources,
      devices,
    }
  },
})
