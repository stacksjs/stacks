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

    // A social post belongs to a User, and the column is NOT NULL - so an
    // author-less payload used to pass validation and then fail at the
    // database as a 500. Say so plainly instead.
    if (data.user_id === null)
      return response.json({ message: 'A social post needs an author.' }, 422)

    try {
      const post = await SocialPost.create({
        ...data,
        user_id: data.user_id,
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
