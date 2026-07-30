type DataRecord = Record<string, unknown>

export const DASHBOARD_LOG_TYPES = ['error', 'warning', 'info', 'success'] as const

export type DashboardLogType = typeof DASHBOARD_LOG_TYPES[number] | 'unknown'

export interface DashboardLogRecord {
  id: number
  timestamp: string
  type: DashboardLogType
  source: string
  message: string
  project: string
  stacktrace: string
  file: string
  createdAt: string
  updatedAt: string
}

export interface DashboardLogSummary {
  total: number
  error: number
  warning: number
  info: number
  success: number
}

function numberValue(value: unknown): number {
  const normalized = Number(value)
  return Number.isFinite(normalized) ? normalized : 0
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value)
}

function dateValue(value: unknown, fallback: unknown): string {
  const candidate = typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))
    ? new Date(Number(value))
    : new Date(textValue(value))
  if (!Number.isNaN(candidate.getTime()))
    return candidate.toISOString()

  const fallbackDate = new Date(textValue(fallback))
  return Number.isNaN(fallbackDate.getTime()) ? '' : fallbackDate.toISOString()
}

function logType(value: unknown): DashboardLogType {
  const normalized = textValue(value).toLowerCase()
  return DASHBOARD_LOG_TYPES.includes(normalized as typeof DASHBOARD_LOG_TYPES[number])
    ? normalized as typeof DASHBOARD_LOG_TYPES[number]
    : 'unknown'
}

export function normalizeDashboardLog(value: unknown): DashboardLogRecord {
  const row = value && typeof value === 'object' && !Array.isArray(value)
    ? value as DataRecord
    : {}
  const createdAt = textValue(row.created_at)

  return {
    id: numberValue(row.id),
    timestamp: dateValue(row.timestamp, createdAt),
    type: logType(row.type),
    source: textValue(row.source),
    message: textValue(row.message),
    project: textValue(row.project),
    stacktrace: textValue(row.stacktrace),
    file: textValue(row.file),
    createdAt,
    updatedAt: textValue(row.updated_at),
  }
}

export function summarizeDashboardLogTypes(
  rows: Array<{ type: unknown, count: unknown }>,
  total: unknown,
): DashboardLogSummary {
  const summary: DashboardLogSummary = {
    total: numberValue(total),
    error: 0,
    warning: 0,
    info: 0,
    success: 0,
  }

  for (const row of rows) {
    const type = logType(row.type)
    if (type !== 'unknown')
      summary[type] = numberValue(row.count)
  }

  return summary
}
