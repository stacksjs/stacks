import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { SocialPost } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'SocialPostDestroyAction',
  description: 'Deletes a persisted SocialPost record from the dashboard.',
  method: 'DELETE',

  async handle(request: RequestInstance) {
    const post = await SocialPost.find(Number(request.getParam('id')))
    if (!post)
      return response.json({ message: 'Social post not found.' }, 404)
    await post.delete()
    return response.noContent()
  },
})
