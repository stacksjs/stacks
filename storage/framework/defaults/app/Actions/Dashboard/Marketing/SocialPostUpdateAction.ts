import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { SocialPost } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { marketingModelError, marketingRecordId } from './marketing-response'
import { socialPostWriteData, validateSocialPostWriteData } from './social-post-records'

export default new Action({
  name: 'SocialPostUpdateAction',
  description: 'Updates a persisted SocialPost record from the dashboard.',
  method: 'PATCH',
  model: SocialPost,

  async handle(request: RequestInstance) {
    const id = marketingRecordId(request)
    if (!id)
      return response.json({ message: 'A valid social post id is required.' }, 400)
    const data = socialPostWriteData(await request.all())
    const validationError = validateSocialPostWriteData(data)
    if (validationError)
      return response.json({ message: validationError }, 422)

    try {
      const post = await SocialPost.find(id)
      if (!post)
        return response.json({ message: 'Social post not found.' }, 404)

      await post.update({
        ...data,
        platform: data.platform as Exclude<typeof data.platform, ''>,
      })
      return response.json({ id })
    }
    catch (error) {
      return marketingModelError(error, 'Social post could not be updated.', 'SocialPostUpdateAction')
    }
  },
})
