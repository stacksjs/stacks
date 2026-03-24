import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'WebAnalyticsAction',
  description: 'Returns web analytics data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      overview: {
        realtime: 42,
        people: 1247,
        views: 8934,
        avgTimeOnSite: '3m 24s',
        bounceRate: '34.2%',
        eventCompletions: 523,
      },
      traffic: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
        visitors: Math.floor(Math.random() * 500) + 200,
        pageViews: Math.floor(Math.random() * 1500) + 500,
      })),
      pages: [
        { path: '/', entries: 3421, visitors: 2890, views: 5234, percentage: 35.2 },
        { path: '/docs', entries: 1856, visitors: 1654, views: 2891, percentage: 19.4 },
        { path: '/blog', entries: 1243, visitors: 1102, views: 2156, percentage: 14.5 },
        { path: '/pricing', entries: 987, visitors: 876, views: 1432, percentage: 9.6 },
        { path: '/about', entries: 654, visitors: 543, views: 987, percentage: 6.6 },
      ],
      referrers: [
        { name: 'Google', visitors: 4521, views: 8932, percentage: 45.2 },
        { name: 'GitHub', visitors: 2134, views: 3876, percentage: 21.3 },
        { name: 'Twitter/X', visitors: 1432, views: 2654, percentage: 14.3 },
        { name: 'Direct', visitors: 987, views: 1654, percentage: 9.9 },
        { name: 'Hacker News', visitors: 543, views: 987, percentage: 5.4 },
      ],
      devices: [
        { name: 'Desktop', visitors: 6234, percentage: 62.3 },
        { name: 'Mobile', visitors: 2876, percentage: 28.8 },
        { name: 'Tablet', visitors: 890, percentage: 8.9 },
      ],
      browsers: [
        { name: 'Chrome', visitors: 5432, percentage: 54.3 },
        { name: 'Safari', visitors: 2134, percentage: 21.3 },
        { name: 'Firefox', visitors: 1234, percentage: 12.3 },
        { name: 'Edge', visitors: 876, percentage: 8.8 },
        { name: 'Other', visitors: 324, percentage: 3.2 },
      ],
      countries: [
        { name: 'United States', visitors: 4521, percentage: 45.2, flag: '🇺🇸' },
        { name: 'United Kingdom', visitors: 1234, percentage: 12.3, flag: '🇬🇧' },
        { name: 'Germany', visitors: 987, percentage: 9.9, flag: '🇩🇪' },
        { name: 'Canada', visitors: 876, percentage: 8.8, flag: '🇨🇦' },
        { name: 'Australia', visitors: 654, percentage: 6.5, flag: '🇦🇺' },
      ],
    }
  },
})
