import { Action } from '@stacksjs/actions'
import { Activity } from '@stacksjs/orm'

export default new Action({
  name: 'ActivityIndexAction',
  description: 'Returns recent activity data for the dashboard.',
  method: 'GET',
  async handle() {
    const items = await Activity.orderBy('created_at', 'desc').limit(50).get()
    const count = await Activity.count()

    const filters = ['All', 'Creates', 'Updates', 'Deletes', 'Schema', 'Exports']

    return {
      activities: items.map(i => i.toJSON()),
      filters,
      stats: [
        { label: 'Total Activities', value: String(count) },
      ],
    }
  },
})
