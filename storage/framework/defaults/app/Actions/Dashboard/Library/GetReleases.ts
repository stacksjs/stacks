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

      // Only columns the Release model actually declares. `released_at`,
      // `changes`, `change_count` and `breaking` were read here but have never
      // existed on the model, so they resolved to '' / 0 / false on every row
      // - the same fabricated-metric problem 9882e7ede removed from the rest
      // of this dashboard, left behind in this one action. Nothing consumed
      // them.
      const releases = allReleases.map(r => ({
        version: String(r.get('version') || ''),
        date: String(r.get('created_at') || ''),
        type: String(r.get('type') || 'patch'),
        status: String(r.get('status') || 'previous'),
        notes: String(r.get('notes') || ''),
      }))

      return { releases }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Releases could not be loaded.', 'GetReleases')
    }
  },
})
