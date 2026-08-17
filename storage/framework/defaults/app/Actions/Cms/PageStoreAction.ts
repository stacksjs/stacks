import { Action } from '@stacksjs/actions'
import { pages } from '@stacksjs/cms'
import { response } from '@stacksjs/router'
import { requireSite } from '@stacksjs/sites'

export default new Action({
  name: 'Page Store',
  description: 'Page Store ORM Action',
  method: 'POST',
  model: Page,
  async handle(request) {
    await request.validate()

    // A page belongs to a site, and the site comes from the resolved request
    // context rather than from the body: letting a caller name the site would
    // let them write into somebody else's website.
    const site = requireSite()

    const model = await pages.store({
      site_id: site.id,
      title: request.get('title'),
      slug: request.get('slug'),
      template: request.get('template'),
      meta_description: request.get('meta_description'),
      status: request.get('status') ?? 'draft',
      blocks: request.get('blocks'),
    } as Parameters<typeof pages.store>[0])

    return response.json(model)
  },
})
