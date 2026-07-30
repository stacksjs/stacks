import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { SocialPost } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { socialPostWriteData, validateSocialPostSchedule } from './social-post-records'

export default new Action({
  name: 'SocialPostUpdateAction',
  description: 'Updates a persisted SocialPost record from the dashboard.',
  method: 'PATCH',
  model: SocialPost,

  async handle(request: RequestInstance) {
    await request.validate()
    const id = Number(request.getParam('id'))
    const post = await SocialPost.find(id)
    if (!post)
      return response.json({ message: 'Social post not found.' }, 404)

    const data = socialPostWriteData(await request.all())
    const scheduleError = validateSocialPostSchedule(data)
    if (scheduleError)
      return response.json({ message: scheduleError }, 422)

    await post.update(data)
    return response.json({ id })
  },
})
