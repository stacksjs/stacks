import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { formatDate, PrintDevice } from '@stacksjs/orm'
import { request as routerRequest, response } from '@stacksjs/router'
import {
  commerceEnum,
  commerceIdentifier,
  commerceNumber,
  commerceOptionalString,
  commerceValue,
} from './commerce-record'
import { normalizePrintLogRecord, summarizePrintLogs } from './print-log-records'

const STATUSES = ['failed', 'success', 'warning'] as const
const RANGES = ['1', '7', '30', '90', 'all'] as const
const SORTS = {
  duration: ['duration', 'desc'],
  newest: ['timestamp', 'desc'],
  oldest: ['timestamp', 'asc'],
  printer: ['printer', 'asc'],
} as const

type PrintLogSort = keyof typeof SORTS

function queryValue(request: RequestInstance, key: string): string {
  const query = ((routerRequest as any).query || {}) as Record<string, string | string[] | undefined>
  const value = query[key]
  return String((Array.isArray(value) ? value[0] : value) || request.get(key) || '').trim()
}

function selectedSort(value: string): PrintLogSort {
  return value in SORTS ? value as PrintLogSort : 'newest'
}

export default new Action({
  name: 'CommercePrintLogsAction',
  description: 'Returns filtered, sorted, paginated Receipt print logs.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    try {
      const requestedPage = Math.max(1, Number.parseInt(queryValue(request, 'page') || '1', 10) || 1)
      const perPage = Math.min(100, Math.max(1, Number.parseInt(queryValue(request, 'per_page') || '20', 10) || 20))
      const search = queryValue(request, 'search')
      const printer = queryValue(request, 'printer')
      const requestedStatus = queryValue(request, 'status').toLowerCase()
      const status = STATUSES.includes(requestedStatus as typeof STATUSES[number]) ? requestedStatus : ''
      const requestedRange = queryValue(request, 'range').toLowerCase()
      const range = RANGES.includes(requestedRange as typeof RANGES[number]) ? requestedRange : '30'
      const days = range === 'all' ? 0 : Number(range)
      const sort = selectedSort(queryValue(request, 'sort').toLowerCase())
      const [sortColumn, sortDirection] = SORTS[sort]
      const searchPattern = `%${search}%`
      const cutoff = days ? formatDate(Date.now() - days * 86400000) : ''

      const applyFilters = <T extends {
        where: (...args: any[]) => T
        whereAny: (columns: string[], operator: string, value: unknown) => T
      }>(query: T): T => {
        let filtered = query
        if (printer)
          filtered = filtered.where('printer', '=', printer)
        if (status)
          filtered = filtered.where('status', '=', status)
        if (cutoff)
          filtered = filtered.where('timestamp', '>=', cutoff)
        if (search)
          filtered = filtered.whereAny(['printer', 'document', 'status'], 'like', searchPattern)
        return filtered
      }

      const [countRow, printerRows, statusRows, printDevices] = await Promise.all([
        applyFilters(db.selectFrom('receipts').select(db.fn.count('id').as('count')))
          .executeTakeFirst() as Promise<{ count: number | string } | undefined>,
        db.selectFrom('receipts').select('printer').distinct().orderBy('printer', 'asc').limit(500).execute() as Promise<Array<{ printer: string | null }>>,
        db.selectFrom('receipts').select('status').distinct().orderBy('status', 'asc').limit(10).execute() as Promise<Array<{ status: string | null }>>,
        PrintDevice.orderBy('id', 'asc').limit(500).get(),
      ])

      const total = commerceNumber(countRow?.count ?? 0, 'Receipt query', 'count', {
        min: 0,
        integer: true,
      })
      const totalPages = Math.max(1, Math.ceil(total / perPage))
      const page = Math.min(requestedPage, totalPages)
      const rows = await applyFilters(db.selectFrom('receipts').selectAll())
        .orderBy(sortColumn, sortDirection)
        .orderBy('id', sortDirection)
        .limit(perPage)
        .offset((page - 1) * perPage)
        .execute()
      const printDeviceIds = new Set(printDevices.map(device =>
        commerceIdentifier(commerceValue(device, 'id', 'uuid'), 'PrintDevice'),
      ))
      const records = rows.map(row => normalizePrintLogRecord(row, printDeviceIds))

      return {
        records,
        summary: summarizePrintLogs(records),
        pagination: {
          page,
          perPage,
          total,
          totalPages,
        },
        options: {
          printers: printerRows
            .map(row => commerceOptionalString(row.printer, 'Receipt query', 'printer'))
            .filter(Boolean),
          statuses: statusRows.map(row =>
            commerceEnum(row.status, 'Receipt query', 'status', STATUSES),
          ),
        },
      }
    }
    catch (error) {
      return response.json({
        message: error instanceof Error ? error.message : 'Print log records could not be read.',
      }, 503)
    }
  },
})
