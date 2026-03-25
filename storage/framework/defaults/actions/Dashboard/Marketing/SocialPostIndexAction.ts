import { Action } from '@stacksjs/actions'
import { SocialPost } from '@stacksjs/orm'

export default new Action({
  name: 'SocialPostIndexAction',
  description: 'Returns social media post data for the dashboard.',
  method: 'GET',
  async handle() {
    const items = await SocialPost.orderBy('created_at', 'desc').limit(50).get()
    const count = await SocialPost.count()

    const stats = [
      { label: 'Total Posts', value: String(count) },
      { label: 'Engagement', value: '-' },
      { label: 'Scheduled', value: '-' },
      { label: 'Drafts', value: '-' },
    ]

    const platforms = ['All', 'Twitter', 'LinkedIn', 'Instagram', 'Facebook']

    return {
      posts: items.map(i => i.toJSON()),
      stats,
      platforms,
    }
  },
})
