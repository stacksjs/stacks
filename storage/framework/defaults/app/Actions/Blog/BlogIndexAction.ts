import { Action, listBlogPosts } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Blog Index',
  description: 'Lists every markdown post in content/blog, drafts included.',
  method: 'GET',
  async handle() {
    const posts = listBlogPosts()

    return response.json({
      posts,
      publishedCount: posts.filter(p => !p.draft).length,
      draftCount: posts.filter(p => p.draft).length,
      featuredCount: posts.filter(p => p.featured).length,
    })
  },
})
