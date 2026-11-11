import type { UsageReport, UsageState } from './types'
import { isPeriod } from './period'

export type { UsageReport, UsageState } from './types'
export { parseUsageHeader, USAGE_HEADER } from './usage-header'
export type { UsageHeader } from './usage-header'

/**
 * Typed readers an app uses to call the HQ services it connected to, each
 * with that service's own read key.
 *
 * One rule governs everything here: a reader NEVER throws into the caller.
 * These run while an app renders its own dashboard, and a service being slow,
 * down or misconfigured must cost that page a panel, not the page. Every
 * failure is a typed `HqUnavailable` value.
 */

export type HqServiceName = 'bughq' | 'loghq' | 'analyticshq' | 'statushq' | 'commshq'

export interface HqServiceConfig {
  /** The service's origin, e.g. `https://bughq.example`. */
  url: string
  /** That service's read key. Server-side only. */
  readKey: string
  /** The project (or site) id the key was issued for. Needed by project-scoped readers. */
  project?: string
}

export interface HqClientOptions {
  services: Partial<Record<HqServiceName, HqServiceConfig | null | undefined>>
  /** Default 3 seconds. A dashboard panel is not worth waiting longer for. */
  timeoutMs?: number
  fetch?: (input: string, init?: RequestInit) => Promise<Response>
}

export type HqUnavailableReason
  /** No url or read key (or, for a project reader, no project) is configured. */
  = | 'not_configured'
  /** The read key was refused. */
    | 'unauthorized'
    | 'timeout'
    | 'network'
  /** The service answered with a status that is neither 2xx nor an auth refusal. */
    | 'http'
  /** A 2xx whose body was not the documented shape. */
    | 'bad_response'

export interface HqUnavailable {
  ok: false
  unavailable: true
  service: HqServiceName
  reason: HqUnavailableReason
  status?: number
  message: string
}

export type HqResult<T> = { ok: true, data: T } | HqUnavailable

/** LogHQ `GET /api/projects/{project}/logs`. */
export interface LogQuery {
  /** One level, or several: `['error', 'critical']`. */
  level?: string | string[]
  channel?: string
  environment?: string
  trace?: string
  request?: string
  /** Case-insensitive substring of the message. */
  search?: string
  /** Keyset cursor: entries older than this timestamp. Pass the previous page's `nextCursor`. */
  before?: string
  /** 1 to 200; the service defaults to 100. */
  limit?: number
}

export interface LogEntry {
  id: string
  level: string
  message: string
  channel: string | null
  environment: string | null
  release: string | null
  framework: string | null
  host: string | null
  timestamp: string
  createdAt: string | null
  traceId: string | null
  requestId: string | null
}

export interface LogPage {
  logs: LogEntry[]
  nextCursor: string | null
}

export interface LogReader {
  list: (query?: LogQuery) => Promise<HqResult<LogPage>>
}

/** BugHQ `GET /api/projects/{project}/issues`. */
export interface IssueQuery {
  /** e.g. `unresolved`, `resolved`. Omit for every status. */
  status?: string
}

export interface Issue {
  id: string
  title: string
  culprit: string | null
  errorType: string | null
  level: string | null
  status: string
  count: number
  firstSeen: string | null
  lastSeen: string | null
}

export interface IssueReader {
  list: (query?: IssueQuery) => Promise<HqResult<Issue[]>>
}

/**
 * The three readers below are contracts only. No service exposes a read-key
 * endpoint for them yet; the package README lists what each must add.
 */
export interface AnalyticsQuery {
  /** ISO dates, inclusive. */
  from?: string
  to?: string
}

export interface AnalyticsSummary {
  pageviews: number
  visitors: number
  topPages: { path: string, pageviews: number }[]
}

export interface AnalyticsReader {
  summary: (query?: AnalyticsQuery) => Promise<HqResult<AnalyticsSummary>>
}

export interface UptimeMonitor {
  id: string
  name: string
  url: string | null
  status: 'up' | 'down' | 'paused' | 'unknown'
  /** Over the service's default window, 0 to 100. */
  uptimePercent: number | null
  lastCheckedAt: string | null
}

export interface UptimeReader {
  monitors: () => Promise<HqResult<UptimeMonitor[]>>
}

export interface CommsSummary {
  sent: number
  delivered: number
  bounced: number
  contacts: number
}

export interface CommsReader {
  summary: () => Promise<HqResult<CommsSummary>>
}

export interface HqClient {
  /** `GET /api/v1/usage` on one service. */
  getUsage: (service: HqServiceName) => Promise<HqResult<UsageReport[]>>
  logs: LogReader
  issues: IssueReader
}

const STATES: ReadonlySet<string> = new Set<UsageState>(['ok', 'warn', 'over', 'sampled'])

type Row = Record<string, unknown>

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string | null {
  if (value instanceof Date)
    return value.toISOString()
  return value === null || value === undefined ? null : String(value)
}

function toUsageReport(value: unknown): UsageReport | null {
  if (!isRow(value) || typeof value.meter !== 'string' || typeof value.used !== 'number' || !Number.isFinite(value.used))
    return null
  if (!(value.limit === null || (typeof value.limit === 'number' && Number.isFinite(value.limit))))
    return null
  if (typeof value.state !== 'string' || !STATES.has(value.state) || !isPeriod(value.period) || typeof value.upgradeUrl !== 'string')
    return null
  return { meter: value.meter, used: value.used, limit: value.limit, period: value.period, state: value.state as UsageState, upgradeUrl: value.upgradeUrl }
}

function toLogEntry(value: unknown): LogEntry | null {
  if (!isRow(value) || value.id == null || value.message == null)
    return null
  return {
    id: String(value.id),
    level: text(value.level) ?? 'info',
    message: String(value.message),
    channel: text(value.channel),
    environment: text(value.environment),
    release: text(value.release),
    framework: text(value.framework),
    host: text(value.host),
    timestamp: text(value.timestamp) ?? '',
    createdAt: text(value.created_at),
    traceId: text(value.trace_id),
    requestId: text(value.request_id),
  }
}

function toIssue(value: unknown): Issue | null {
  if (!isRow(value) || value.id == null)
    return null
  return {
    id: String(value.id),
    title: text(value.title) ?? '',
    culprit: text(value.culprit),
    errorType: text(value.error_type),
    level: text(value.level),
    status: text(value.status) ?? 'unresolved',
    count: Number(value.count ?? 0) || 0,
    firstSeen: text(value.first_seen),
    lastSeen: text(value.last_seen),
  }
}

/** Every element must convert, or the whole body is not the documented shape. */
function all<T>(values: unknown, convert: (value: unknown) => T | null): T[] | null {
  if (!Array.isArray(values))
    return null
  const out: T[] = []
  for (const value of values) {
    const converted = convert(value)
    if (converted === null)
      return null
    out.push(converted)
  }
  return out
}

export function createHqClient(options: HqClientOptions): HqClient {
  const timeoutMs = options.timeoutMs ?? 3000
  const send = options.fetch ?? ((input: string, init?: RequestInit) => fetch(input, init))

  const unavailable = (service: HqServiceName, reason: HqUnavailableReason, message: string, status?: number): HqUnavailable =>
    ({ ok: false, unavailable: true, service, reason, message, ...(status === undefined ? {} : { status }) })

  async function read<T>(
    service: HqServiceName,
    path: (config: HqServiceConfig) => string | null,
    parse: (body: unknown) => T | null,
  ): Promise<HqResult<T>> {
    // Everything, configuration included, sits inside the try: a reader that
    // can throw at all can throw into somebody's page render.
    try {
      const config = options.services[service]
      if (!config?.url || !config.readKey)
        return unavailable(service, 'not_configured', `${service} has no url or read key configured`)
      const target = path(config)
      if (target === null)
        return unavailable(service, 'not_configured', `${service} has no project configured`)

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)
      let response: Response
      try {
        response = await send(`${config.url.replace(/\/+$/, '')}${target}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${config.readKey}`, Accept: 'application/json' },
          signal: controller.signal,
        })
      }
      catch (error) {
        return controller.signal.aborted
          ? unavailable(service, 'timeout', `${service} did not answer within ${timeoutMs}ms`)
          : unavailable(service, 'network', error instanceof Error ? error.message : String(error))
      }
      finally {
        clearTimeout(timer)
      }

      // A service answers 404 rather than 401 for a key that does not open the
      // project, so that a guess cannot tell "wrong key" from "no such project".
      if (response.status === 401 || response.status === 403)
        return unavailable(service, 'unauthorized', `${service} refused the read key`, response.status)
      if (!response.ok)
        return unavailable(service, 'http', `${service} answered ${response.status}`, response.status)

      const data = parse(await response.json().catch(() => undefined))
      return data === null
        ? unavailable(service, 'bad_response', `${service} answered a body that is not the documented shape`, response.status)
        : { ok: true, data }
    }
    catch (error) {
      return unavailable(service, 'network', error instanceof Error ? error.message : String(error))
    }
  }

  const project = (config: HqServiceConfig, rest: string, query?: URLSearchParams): string | null => {
    if (!config.project)
      return null
    const search = query?.toString()
    return `/api/projects/${encodeURIComponent(config.project)}${rest}${search ? `?${search}` : ''}`
  }

  return {
    getUsage: service => read(service, () => '/api/v1/usage', body => all(body, toUsageReport)),

    logs: {
      list: (query = {}) => {
        const params = new URLSearchParams()
        const level = Array.isArray(query.level) ? query.level.join(',') : query.level
        const fields: [string, string | number | undefined][] = [
          ['level', level],
          ['channel', query.channel],
          ['environment', query.environment],
          ['trace', query.trace],
          ['request', query.request],
          ['q', query.search],
          ['before', query.before],
          ['limit', query.limit],
        ]
        for (const [name, value] of fields) {
          if (value !== undefined && value !== '')
            params.set(name, String(value))
        }
        return read('loghq', config => project(config, '/logs', params), (body) => {
          const logs = isRow(body) ? all(body.logs, toLogEntry) : null
          return logs === null ? null : { logs, nextCursor: text((body as Row).nextCursor) }
        })
      },
    },

    issues: {
      list: (query = {}) => {
        const params = new URLSearchParams()
        if (query.status)
          params.set('status', query.status)
        return read('bughq', config => project(config, '/issues', params), body => isRow(body) ? all(body.issues, toIssue) : null)
      },
    },
  }
}
