import { Action } from '@stacksjs/actions'
import { Comment } from '@stacksjs/orm'

export default new Action({
  name: 'CommentIndexAction',
  description: 'Returns comments data for the dashboard.',
  method: 'GET',
  async handle() {
    const items = await Comment.orderBy('created_at', 'desc').limit(50).get()
    const count = await Comment.count()

    return {
      comments: items.map(i => i.toJSON()),
      stats: { total: count, pending: 0, approved: 0, spam: 0 },
    }
  },
})
