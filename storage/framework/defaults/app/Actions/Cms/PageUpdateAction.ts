import { Action } from '@stacksjs/actions'
import { pages } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Page Update',
  description: 'Page Update ORM Action',
  method: 'PATCH',
  model: Page,
  async handle(request) {
    await request.validate()

    const id = Number(request.getParam('id'))

    // Only what the request actually sent. Spreading every field would write
    // `undefined` over a title the caller never mentioned, and a slug or
    // blocks value that is present goes through the document path in
    // `pages.update`, which re-derives the path and snapshots a revision.
    const data: Record<string, unknown> = {}
    for (const field of ['title', 'slug', 'template', 'meta_description', 'status', 'blocks'] as const) {
      const value = request.get(field)
      if (value !== undefined && value !== null)
        data[field] = value
    }

    const model = await pages.update(id, data as Parameters<typeof pages.update>[1])

    return response.json(model)
  },
})
