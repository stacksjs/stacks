import { Action } from '@stacksjs/actions'
import { SocialPost } from '@stacksjs/orm'

export default new Action({
  name: 'SocialPostIndexAction',
  description: 'Returns social media post data for the dashboard.',
  method: 'GET',
  async handle() {
    const platforms = ['All', 'Twitter', 'LinkedIn', 'Instagram', 'Facebook']

    try {
      const allPosts = await SocialPost.orderByDesc('id').get()

      const posts = allPosts.map(p => ({
        platform: String(p.get('platform') || ''),
        content: String(p.get('content') || p.get('body') || ''),
        status: String(p.get('status') || 'draft'),
        engagement: String(p.get('engagement') || p.get('engagement_count') || '-'),
        scheduled: String(p.get('scheduled_at') || p.get('published_at') || '-'),
      }))

      const scheduledCount = posts.filter(p => p.status === 'scheduled').length
      const draftCount = posts.filter(p => p.status === 'draft').length

      const stats = [
        { label: 'Total Reach', value: '-' },
        { label: 'Engagement', value: '-' },
        { label: 'Scheduled', value: String(scheduledCount) },
        { label: 'Drafts', value: String(draftCount) },
      ]

      return { posts, stats, platforms }
    }
    catch {
      return {
        posts: [],
        stats: [
          { label: 'Total Reach', value: '-' },
          { label: 'Engagement', value: '-' },
          { label: 'Scheduled', value: '0' },
          { label: 'Drafts', value: '0' },
        ],
        platforms,
      }
    }
  },
})
