import { Action } from '@stacksjs/actions'
import { Post, Comment } from '@stacksjs/orm'

export default new Action({
  name: 'ContentDashboardAction',
  description: 'Returns content dashboard overview data.',
  method: 'GET',
  async handle() {
    const postCount = await Post.count()
    const commentCount = await Comment.count()
    const topPosts = await Post.orderBy('created_at', 'desc').limit(10).get()
    const recentComments = await Comment.orderBy('created_at', 'desc').limit(10).get()

    const stats = [
      { label: 'Total Posts', value: String(postCount), trend: '', up: true },
      { label: 'Published', value: '-', trend: '', up: true },
      { label: 'Draft', value: '-', trend: '', up: true },
      { label: 'Total Comments', value: String(commentCount), trend: '', up: true },
    ]

    return {
      stats,
      topPosts: topPosts.map(i => i.toJSON()),
      recentComments: recentComments.map(i => i.toJSON()),
    }
  },
})
