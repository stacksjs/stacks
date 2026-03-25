import { Action } from '@stacksjs/actions'
import { Request } from '@stacksjs/orm'

export default new Action({
  name: 'RequestIndexAction',
  description: 'Returns request history data for the dashboard.',
  method: 'GET',
  async handle() {
    const items = await Request.orderBy('created_at', 'desc').limit(50).get()
    const count = await Request.count()

    const stats = [
      { label: 'Total Requests', value: String(count) },
      { label: 'Avg Response', value: '-' },
      { label: 'Error Rate', value: '-' },
      { label: 'Requests/min', value: '-' },
    ]

    return {
      requests: items.map(i => i.toJSON()),
      stats,
    }
  },
})
