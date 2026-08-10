import { Action } from '@stacksjs/actions'
import { Release } from '@stacksjs/orm'
import { dashboardOperationalError } from '../dashboard-response'

export default new Action({
  name: 'GetReleases',
  description: 'Gets your releases.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const allReleases = await Release.orderByDesc('id').limit(500).get()

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
    catch (error) {
      return dashboardOperationalError(error, 'Releases could not be loaded.', 'GetReleases')
    }
  },
})
