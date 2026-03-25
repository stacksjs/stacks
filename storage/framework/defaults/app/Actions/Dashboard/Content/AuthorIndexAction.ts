import { Action } from '@stacksjs/actions'
import { Author } from '@stacksjs/orm'

export default new Action({
  name: 'AuthorIndexAction',
  description: 'Returns authors data for the dashboard.',
  method: 'GET',
  async handle() {
    try {
      const allAuthors = await Author.all()

      const authors = allAuthors.map(a => ({
        name: String(a.get('name') || ''),
        email: String(a.get('email') || ''),
        role: String(a.get('role') || 'Writer'),
        posts: Number(a.get('post_count') || a.get('posts') || 0),
        avatar: String(a.get('name') || '').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
      }))

      return { authors }
    }
    catch {
      return { authors: [] }
    }
  },
})
