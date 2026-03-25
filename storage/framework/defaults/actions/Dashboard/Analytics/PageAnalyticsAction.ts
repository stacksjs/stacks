import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'PageAnalyticsAction',
  description: 'Returns page analytics data for the dashboard.',
  method: 'GET',
  async handle() {
    // TODO: replace with model query when available
    return {
      pages: [
        { path: '/', title: 'Home', views: 12543, uniqueViews: 8934, avgTime: '2m 30s', bounceRate: '32.1%' },
        { path: '/docs', title: 'Documentation', views: 8765, uniqueViews: 6543, avgTime: '5m 12s', bounceRate: '18.5%' },
        { path: '/blog', title: 'Blog', views: 6543, uniqueViews: 4321, avgTime: '3m 45s', bounceRate: '28.7%' },
        { path: '/pricing', title: 'Pricing', views: 4321, uniqueViews: 3210, avgTime: '1m 56s', bounceRate: '45.2%' },
        { path: '/about', title: 'About', views: 2345, uniqueViews: 1876, avgTime: '1m 12s', bounceRate: '52.3%' },
      ],
    }
  },
})
