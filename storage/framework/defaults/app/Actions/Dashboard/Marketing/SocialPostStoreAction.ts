import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { SocialPost } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { socialPostWriteData, validateSocialPostSchedule } from './social-post-records'

export default new Action({
  name: 'SocialPostStoreAction',
  description: 'Creates a persisted SocialPost record from the dashboard.',
  method: 'POST',
  model: SocialPost,

  async handle(request: RequestInstance) {
    await request.validate()
    const data = socialPostWriteData(await request.all())
    const scheduleError = validateSocialPostSchedule(data)
    if (scheduleError)
      return response.json({ message: scheduleError }, 422)

    const post = await SocialPost.create({
      ...data,
      likes: 0,
      shares: 0,
      comments: 0,
      reach: 0,
    })
    return response.json({ id: post.get('id') }, 201)
  },
})
