import { Action } from '@stacksjs/actions'
import { Comment } from '@stacksjs/orm'

export default new Action({
  name: 'CommentIndexAction',
  description: 'Returns comments data for the dashboard.',
  method: 'GET',
  async handle() {
    try {
      const allComments = await Comment.orderBy('created_at', 'desc').get()
      const totalCount = await Comment.count()

      const comments = allComments.map(c => ({
        id: Number(c.get('id')),
        author: String(c.get('author') || c.get('name') || ''),
        email: String(c.get('email') || ''),
        content: String(c.get('content') || c.get('body') || ''),
        status: String(c.get('status') || 'pending'),
        date: String(c.get('created_at') || ''),
        postTitle: String(c.get('post_title') || ''),
        postId: Number(c.get('post_id') || 0),
        ip: String(c.get('ip') || ''),
      }))

      const pending = comments.filter(c => c.status === 'pending').length
      const approved = comments.filter(c => c.status === 'approved').length
      const spam = comments.filter(c => c.status === 'spam').length

      return {
        comments,
        stats: { total: totalCount, pending, approved, spam },
      }
    }
    catch {
      return {
        comments: [],
        stats: { total: 0, pending: 0, approved: 0, spam: 0 },
      }
    }
  },
})
