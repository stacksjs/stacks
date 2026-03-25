import { Action } from '@stacksjs/actions'
import { Page } from '@stacksjs/orm'

export default new Action({
  name: 'PageIndexAction',
  description: 'Returns pages data for the dashboard.',
  method: 'GET',
  async handle() {
    try {
      const allPages = await Page.orderBy('updated_at', 'desc').get()

      const pages = allPages.map(p => ({
        title: String(p.get('title') || ''),
        slug: String(p.get('slug') || ''),
        status: String(p.get('status') || 'draft'),
        updated: String(p.get('updated_at') || ''),
      }))

      return { pages }
    }
    catch {
      return { pages: [] }
    }
  },
})
