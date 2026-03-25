import { Action } from '@stacksjs/actions'
import { Request } from '@stacksjs/orm'

export default new Action({
  name: 'RequestIndexAction',
  description: 'Returns request history data for the dashboard.',
  method: 'GET',
  async handle() {
    try {
      const allRequests = await Request.orderByDesc('id').limit(50).get()
      const totalReqs = await Request.count()

      const requests = allRequests.map(r => ({
        method: String(r.get('method') || 'GET'),
        path: String(r.get('path') || r.get('url') || ''),
        status: Number(r.get('status_code') || r.get('status') || 200),
        time: String(r.get('duration') || '-'),
        timestamp: String(r.get('created_at') || ''),
      }))

      const errorReqs = allRequests.filter(r => (Number(r.get('status_code') || r.get('status') || 200)) >= 400).length

      const stats = [
        { label: 'Total Requests', value: String(totalReqs) },
        { label: 'Avg Response', value: '-' },
        { label: 'Error Rate', value: totalReqs > 0 ? `${((errorReqs / totalReqs) * 100).toFixed(2)}%` : '0%' },
        { label: 'Requests/min', value: '-' },
      ]

      return { requests, stats }
    }
    catch {
      return {
        requests: [],
        stats: [
          { label: 'Total Requests', value: '0' },
          { label: 'Avg Response', value: '-' },
          { label: 'Error Rate', value: '0%' },
          { label: 'Requests/min', value: '-' },
        ],
      }
    }
  },
})
