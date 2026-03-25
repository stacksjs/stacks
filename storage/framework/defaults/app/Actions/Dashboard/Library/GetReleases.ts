import { Action } from '@stacksjs/actions'
import { Release } from '@stacksjs/orm'

export default new Action({
  name: 'GetReleases',
  description: 'Gets your releases.',
  method: 'GET',

  async handle() {
    try {
      const allReleases = await Release.orderByDesc('id').get()

      const releases = allReleases.map(r => ({
        version: String(r.get('version') || ''),
        date: String(r.get('created_at') || r.get('released_at') || ''),
        type: String(r.get('type') || 'patch'),
        status: String(r.get('status') || 'previous'),
        changes: Number(r.get('changes') || r.get('change_count') || 0),
        breaking: Boolean(r.get('breaking') || false),
      }))

      return { releases }
    }
    catch {
      return { releases: [] }
    }
  },
})
