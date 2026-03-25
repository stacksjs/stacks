import { Action } from '@stacksjs/actions'
import { Tag } from '@stacksjs/orm'

export default new Action({
  name: 'TagIndexAction',
  description: 'Returns tags data for the dashboard.',
  method: 'GET',
  async handle() {
    try {
      const allTags = await Tag.all()

      const tags = allTags.map(t => ({
        name: String(t.get('name') || ''),
        count: Number(t.get('count') || t.get('post_count') || 0),
      }))

      return { tags }
    }
    catch {
      return { tags: [] }
    }
  },
})
