import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { dashboardRequestValue } from '../dashboard-request'
import { dashboardOperationalError } from '../dashboard-response'
import { DASHBOARD_LOG_TYPES, normalizeDashboardLog, summarizeDashboardLogTypes } from './log-dashboard'

const RANGES = ['1', '7', '30', '90', 'all'] as const

function queryValue(request: RequestInstance, key: string): string {
  return dashboardRequestValue(request, key)
}

export default new Action({
  name: 'LogIndexAction',
  description: 'Returns filtered, paginated Log model records for the dashboard.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    try {
      const requestedPage = Math.max(1, Number.parseInt(queryValue(request, 'page') || '1', 10) || 1)
      const perPage = Math.min(100, Math.max(10, Number.parseInt(queryValue(request, 'per_page') || '25', 10) || 25))
      const search = queryValue(request, 'search')
      const requestedType = queryValue(request, 'type').toLowerCase()
      const type = DASHBOARD_LOG_TYPES.includes(requestedType as typeof DASHBOARD_LOG_TYPES[number])
        ? requestedType
        : ''
      const source = queryValue(request, 'source').toLowerCase()
      const project = queryValue(request, 'project')
      const requestedRange = queryValue(request, 'range').toLowerCase()
      const range = RANGES.includes(requestedRange as typeof RANGES[number]) ? requestedRange : '30'
      const cutoff = range === 'all' ? 0 : Date.now() - Number(range) * 86400000
      const searchPattern = `%${search}%`

      const applyFilters = <T extends {
        where: (...args: any[]) => T
        whereAny: (columns: string[], operator: string, value: unknown) => T
      }>(query: T): T => {
        let filtered = query
        if (cutoff)
          filtered = filtered.where('timestamp', '>=', cutoff)
        if (type)
          filtered = filtered.where('type', '=', type)
        if (source)
          filtered = filtered.where('source', '=', source)
        if (project)
          filtered = filtered.where('project', '=', project)
        if (search)
          filtered = filtered.whereAny(['message', 'project', 'file', 'stacktrace'], 'like', searchPattern)
        return filtered
      }

      const [countRow, typeRows, sourceRows, projectRows] = await Promise.all([
        applyFilters(db.selectFrom('logs').select(db.fn.count('id').as('count')))
          .executeTakeFirst() as Promise<{ count: number | string } | undefined>,
        applyFilters(db.selectFrom('logs').select(['type', db.fn.count('id').as('count')]))
          .groupBy('type')
          .execute() as Promise<Array<{ type: string, count: number | string }>>,
        db.selectFrom('logs').select('source').distinct().orderBy('source', 'asc').limit(100).execute() as Promise<Array<{ source: string }>>,
        db.selectFrom('logs').select('project').distinct().orderBy('project', 'asc').limit(500).execute() as Promise<Array<{ project: string }>>,
      ])

      const total = Number(countRow?.count || 0)
      const totalPages = Math.max(1, Math.ceil(total / perPage))
      const page = Math.min(requestedPage, totalPages)
      const rows = await applyFilters(db.selectFrom('logs').select([
        'id',
        'timestamp',
        'type',
        'source',
        'message',
        'project',
        'stacktrace',
        'file',
        'created_at',
        'updated_at',
      ]))
        .orderBy('timestamp', 'desc')
        .orderBy('id', 'desc')
        .limit(perPage)
        .offset((page - 1) * perPage)
        .execute()

      return {
        logs: rows.map(normalizeDashboardLog),
        summary: summarizeDashboardLogTypes(typeRows, total),
        pagination: {
          page,
          perPage,
          total,
          totalPages,
        },
        options: {
          sources: sourceRows.map(row => row.source).filter(Boolean),
          projects: projectRows.map(row => row.project).filter(Boolean),
          types: [...DASHBOARD_LOG_TYPES],
          ranges: [...RANGES],
        },
        generatedAt: new Date().toISOString(),
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Logs could not be loaded.', 'LogIndexAction')
    }
  },
})
