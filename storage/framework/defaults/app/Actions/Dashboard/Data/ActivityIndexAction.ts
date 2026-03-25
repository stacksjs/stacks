import { Action } from '@stacksjs/actions'
import { Activity } from '@stacksjs/orm'

export default new Action({
  name: 'ActivityIndexAction',
  description: 'Returns recent activity data for the dashboard.',
  method: 'GET',
  async handle() {
    const filters = ['All', 'Creates', 'Updates', 'Deletes', 'Schema', 'Exports']

    try {
      const allActivities = await Activity.orderByDesc('id').limit(50).get()

      const activities = allActivities.map(r => ({
        action: String(r.get('action') || r.get('description') || ''),
        table: String(r.get('table_name') || r.get('subject_type') || ''),
        user: String(r.get('user') || r.get('causer_id') || 'system'),
        time: String(r.get('created_at') || ''),
        type: String(r.get('type') || 'update'),
      }))

      return { activities, filters }
    }
    catch {
      return { activities: [], filters }
    }
  },
})
