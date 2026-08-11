import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { SocialPost } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { marketingModelError, marketingRecordId } from './marketing-response'

export default new Action({
  name: 'SocialPostDestroyAction',
  description: 'Deletes a persisted SocialPost record from the dashboard.',
  method: 'DELETE',

  async handle(request: RequestInstance) {
    const id = marketingRecordId(request)
    if (!id)
      return response.json({ message: 'A valid social post id is required.' }, 400)

    try {
      const post = await SocialPost.find(id)
      if (!post)
        return response.json({ message: 'Social post not found.' }, 404)
      await post.delete()
      return response.noContent()
    }
    catch (error) {
      return marketingModelError(error, 'Social post could not be deleted.', 'SocialPostDestroyAction')
    }
  },
})
