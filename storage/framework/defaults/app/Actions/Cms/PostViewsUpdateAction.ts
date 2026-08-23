import { Action } from '@stacksjs/actions'
import { posts } from '@stacksjs/cms'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'Post Views Update',
  description: 'Updates the view count for a post',
  method: 'PATCH',
  async handle(request: RequestInstance) {
    /*
     * PATCH, so these are NOT required: a partial update sends the fields it
     * means to change. The messages used to say "X is required", which fires on
     * a type failure and never on absence - a message describing a rule the
     * block does not have.
     */
    await request.validate({
      views: {
        rule: schema.number(),
        message: {
          views: 'Views must be a number.',
        },
      },
    })
    const postId = Number(request.getParam('id'))
    if (!postId)
      throw new Error('Post ID is required')

    const post = await posts.fetchById(postId)

    if (!post)
      throw new Error(`Post with ID ${postId} not found`)

    const updatedPost = await posts.update(postId, {
      views: (post.views || 0) + 1,
    })

    return response.json(updatedPost)
  },
})
