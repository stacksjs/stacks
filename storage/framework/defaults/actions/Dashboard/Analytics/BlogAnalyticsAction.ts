import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'BlogAnalyticsAction',
  description: 'Returns blog analytics data for the dashboard.',
  method: 'GET',
  async handle() {
    return {
      overview: {
        totalPosts: 142,
        totalViews: 45231,
        avgReadTime: '4m 12s',
        subscriberGrowth: 8.5,
      },
      topPosts: [
        { title: 'Getting Started with Stacks', views: 4521, comments: 23 },
        { title: 'Building APIs with Bun', views: 3876, comments: 18 },
        { title: 'TypeScript Best Practices', views: 2945, comments: 15 },
      ],
    }
  },
})
