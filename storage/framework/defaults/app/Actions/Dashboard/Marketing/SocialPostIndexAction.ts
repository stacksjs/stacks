import { Action } from '@stacksjs/actions'
import { SocialPost, User } from '@stacksjs/orm'
import { normalizeSocialPosts } from './social-post-records'

export default new Action({
  name: 'SocialPostIndexAction',
  description: 'Returns persisted SocialPost records with User relationship context.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const [posts, users] = await Promise.all([
      SocialPost.orderByDesc('id').limit(500).get(),
      User.orderBy('name', 'asc').limit(500).get(),
    ])
    return normalizeSocialPosts(posts, users)
  },
})
