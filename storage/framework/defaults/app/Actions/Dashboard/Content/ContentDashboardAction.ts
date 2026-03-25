import { Action } from '@stacksjs/actions'
import { Post, Page, Comment } from '@stacksjs/orm'

export default new Action({
  name: 'ContentDashboardAction',
  description: 'Returns content dashboard overview data.',
  method: 'GET',
  async handle() {
    try {
      const [postCount, pageCount, commentCount, recentPosts, recentComments] = await Promise.all([
        Post.count(),
        Page.count(),
        Comment.count(),
        Post.orderBy('created_at', 'desc').limit(4).get(),
        Comment.orderBy('created_at', 'desc').limit(3).get(),
      ])

      const stats = [
        { label: 'Total Posts', value: String(postCount), trend: '', up: true },
        { label: 'Pages', value: String(pageCount), trend: '', up: true },
        { label: 'Comments', value: String(commentCount), trend: '', up: true },
        { label: 'Total Views', value: '-', trend: '', up: true },
      ]

      const topPosts = recentPosts.map(p => ({
        title: String(p.get('title') || ''),
        views: Number(p.get('views') || 0),
        comments: 0,
        date: String(p.get('created_at') || ''),
      }))

      const recentCommentsList = recentComments.map(c => ({
        author: String(c.get('author') || c.get('name') || ''),
        content: String(c.get('content') || c.get('body') || ''),
        post: String(c.get('post_title') || ''),
        time: String(c.get('created_at') || ''),
      }))

      return { stats, topPosts, recentComments: recentCommentsList }
    }
    catch {
      return {
        stats: [
          { label: 'Total Posts', value: '0', trend: '', up: true },
          { label: 'Pages', value: '0', trend: '', up: true },
          { label: 'Comments', value: '0', trend: '', up: true },
          { label: 'Total Views', value: '-', trend: '', up: true },
        ],
        topPosts: [],
        recentComments: [],
      }
    }
  },
})
