import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { Request } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { buildWebAnalytics, normalizeAnalyticsRange, normalizeAnalyticsScope } from './request-analytics'

export default new Action({
  name: 'WebAnalyticsAction',
  description: 'Returns privacy-safe web traffic aggregates from recorded application requests.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    let range
    let scope
    try {
      range = normalizeAnalyticsRange(request.get('range'))
      scope = normalizeAnalyticsScope(request.get('scope'))
    }
    catch (error) {
      return response.json({
        message: error instanceof Error ? error.message : 'The analytics query is invalid.',
      }, 422)
    }
    const records = await Request.orderByDesc('id').limit(10_000).get()
    const rows = records.map(record => ({
      method: String(record.get('method') || 'GET'),
      path: String(record.get('path') || ''),
      statusCode: Number(record.get('status_code') || 0),
      durationMs: Number(record.get('duration_ms') || 0),
      ipAddress: String(record.get('ip_address') || ''),
      userAgent: String(record.get('user_agent') || ''),
      createdAt: String(record.get('created_at') || ''),
    }))

    return buildWebAnalytics(rows, range, new Date(), scope)
  },
})
