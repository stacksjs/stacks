import { Action } from '@stacksjs/actions'
import { Request } from '@stacksjs/orm'

export default new Action({
  name: 'RequestIndexAction',
  description: 'Returns request history data for the dashboard.',
  method: 'GET',
  async handle() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const [allRequests, total, errorCount, averageDurationMs, requestsLastHour] = await Promise.all([
      Request.orderByDesc('id').limit(100).get(),
      Request.count(),
      Request.where('status_code', '>=', 400).count(),
      Request.avg('duration_ms'),
      Request.where('created_at', '>=', oneHourAgo).count(),
    ])

    const requests = allRequests.map(request => ({
      id: Number(request.get('id') || 0),
      method: String(request.get('method') || 'GET'),
      path: String(request.get('path') || ''),
      status: Number(request.get('status_code') || 0),
      durationMs: Number(request.get('duration_ms') || 0),
      ipAddress: String(request.get('ip_address') || ''),
      memoryUsageMb: Number(request.get('memory_usage') || 0),
      userAgent: String(request.get('user_agent') || ''),
      errorMessage: String(request.get('error_message') || ''),
      createdAt: String(request.get('created_at') || ''),
    }))

    return {
      requests,
      stats: {
        total,
        errorCount,
        averageDurationMs: Number(averageDurationMs || 0),
        successRate: total > 0 ? ((total - errorCount) / total) * 100 : 0,
        requestsLastHour,
        requestsPerMinute: requestsLastHour / 60,
      },
    }
  },
})
