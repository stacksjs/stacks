import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'BlogAnalyticsAction',
  description: 'Returns blog analytics data for the dashboard.',
  method: 'GET',
  async handle() {
    // TODO: replace with model query when available
    const stats = [
      { label: 'Total Views', value: '234,567', change: '+18.2%' },
      { label: 'Avg Read Time', value: '4m 32s', change: '+12.5%' },
      { label: 'Comments', value: '1,234', change: '+8.1%' },
      { label: 'Shares', value: '567', change: '+15.3%' },
    ]

    const topPosts = [
      { title: 'Getting Started with Stacks', views: '12,345', comments: 89, shares: 45, published: '2024-01-10' },
      { title: '10 Tips for Better Performance', views: '8,765', comments: 56, shares: 34, published: '2024-01-08' },
      { title: 'Understanding the Architecture', views: '6,543', comments: 34, shares: 23, published: '2024-01-05' },
      { title: 'Advanced Configuration Guide', views: '5,432', comments: 28, shares: 19, published: '2024-01-03' },
      { title: 'Best Practices for 2024', views: '4,321', comments: 45, shares: 28, published: '2024-01-01' },
    ]

    const categories = [
      { name: 'Tutorials', posts: 45, views: '89,234' },
      { name: 'Updates', posts: 23, views: '45,678' },
      { name: 'Guides', posts: 34, views: '56,789' },
      { name: 'News', posts: 12, views: '23,456' },
    ]

    const authors = [
      { name: 'John Doe', posts: 34, views: '67,890', avgViews: '1,997' },
      { name: 'Jane Smith', posts: 28, views: '54,321', avgViews: '1,940' },
      { name: 'Bob Wilson', posts: 19, views: '34,567', avgViews: '1,819' },
    ]

    return {
      stats,
      topPosts,
      categories,
      authors,
    }
  },
})
