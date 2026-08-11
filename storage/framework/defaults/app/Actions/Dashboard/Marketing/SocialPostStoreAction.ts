import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { SocialPost } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { marketingModelError } from './marketing-response'
import { socialPostWriteData, validateSocialPostWriteData } from './social-post-records'

export default new Action({
  name: 'SocialPostStoreAction',
  description: 'Creates a persisted SocialPost record from the dashboard.',
  method: 'POST',
  model: SocialPost,

  async handle(request: RequestInstance) {
    const data = socialPostWriteData(await request.all())
    const validationError = validateSocialPostWriteData(data)
    if (validationError)
      return response.json({ message: validationError }, 422)

    try {
      const post = await SocialPost.create({
        ...data,
        platform: data.platform as Exclude<typeof data.platform, ''>,
        likes: 0,
        shares: 0,
        comments: 0,
        reach: 0,
      })
      return response.json({ id: post.get('id') }, 201)
    }
    catch (error) {
      return marketingModelError(error, 'Social post could not be created.', 'SocialPostStoreAction')
    }
  },
})
