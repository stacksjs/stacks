import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'ReferrerAnalyticsAction',
  description: 'Returns referrer analytics data for the dashboard.',
  method: 'GET',
  async handle() {
    // TODO: replace with model query when available
    return {
      referrers: [
        { name: 'Google', visitors: 4521, sessions: 8932, bounceRate: '28.5%' },
        { name: 'GitHub', visitors: 2134, sessions: 3876, bounceRate: '22.3%' },
        { name: 'Twitter/X', visitors: 1432, sessions: 2654, bounceRate: '35.1%' },
        { name: 'Direct', visitors: 987, sessions: 1654, bounceRate: '41.2%' },
        { name: 'Hacker News', visitors: 543, sessions: 987, bounceRate: '18.9%' },
        { name: 'Reddit', visitors: 432, sessions: 765, bounceRate: '25.6%' },
      ],
    }
  },
})
