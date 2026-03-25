import { Action } from '@stacksjs/actions'
import { Team } from '@stacksjs/orm'

export default new Action({
  name: 'TeamIndexAction',
  description: 'Returns team data for the dashboard.',
  method: 'GET',
  async handle() {
    const items = await Team.orderBy('created_at', 'desc').limit(50).get()
    const count = await Team.count()

    const stats = [
      { label: 'Total Teams', value: String(count) },
      { label: 'Total Members', value: '-' },
      { label: 'Active Projects', value: '-' },
    ]

    return {
      teams: items.map(i => i.toJSON()),
      stats,
    }
  },
})
