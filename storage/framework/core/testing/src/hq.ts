import type { ApproveResult, ConnectGrant, HqService, LicenseGrant, MeterReading } from '@stacksjs/hq/service'
import { createHqService, createMemoryConnectCodeStore } from '@stacksjs/hq/service'

/**
 * A stand-in HQ service for tests.
 *
 * It answers the connect and usage contract through the same
 * `@stacksjs/hq/service` handlers the real services mount, and adds the two
 * things `buddy hq:connect` and the dashboard readers also talk to: ingest
 * (`POST /logs`, `POST /errors`) and the read-key project readers
 * (`GET /api/projects/{id}/logs`, `GET /api/projects/{id}/issues`), shaped
 * like LogHQ's and BugHQ's.
 *
 * Nothing listens on a port. `fetch` is handed to the code under test, and
 * `fakeHqFetch` routes several services by origin.
 */

export interface FakeHqServiceOptions {
  /** `loghq`, `bughq`, ... Default `fakehq`. */
  service?: string
  /** Default `https://<service>.test`. */
  origin?: string
  /** What `GET /api/v1/usage` reports for every project. */
  meters?: MeterReading[]
  /** Answer a `confirmCode` beside the code, as LogHQ does. Default false. */
  confirmCode?: boolean
  /** `false` is a service that has not shipped the contract: its connect and usage routes answer 404. */
  contract?: boolean
  /** Approve a connect by itself on this poll (1 is the first). Unset never approves. */
  approveOnPoll?: number
  /** `false` accepts ingest and stores nothing, as a service past its allowance does. */
  storeIngest?: boolean
  /**
   * A licence-only service, as ReportsHQ is: an approved connect carries a
   * `licenseKey` and no keys, and there is no usage route. Default false.
   */
  license?: boolean
  /** Answer `dashboardUrl` as a path, as LogHQ does. Default false. */
  relativeDashboardUrl?: boolean
  now?: () => Date
}

export interface FakeHqLog {
  id: string
  project: string
  level: string
  message: string
  timestamp: string
}

export interface FakeHqIssue {
  id: string
  project: string
  title: string
  error_type: string
  level: string
  status: string
  count: number
  first_seen: string
  last_seen: string
}

export interface FakeHqConversation {
  id: string
  project: string
  subject: string
  status: string
  customer_id: string | null
  updated_at: string
  unread_count: number
}

export interface FakeHqService {
  service: string
  origin: string
  /** Hand this to the code under test in place of `fetch`. */
  fetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
  /** Approve a connect as a signed-in user. Defaults to the newest code that was started. */
  approve: (code?: string) => Promise<ApproveResult>
  /** A connected project and its keys, without walking the connect flow. */
  project: (app?: string) => ConnectGrant
  /** Every code handed out, oldest first. */
  codes: () => string[]
  /** The confirmation code a connect was started with. */
  confirmCodeFor: (code: string) => string | undefined
  grants: () => ConnectGrant[]
  /** What a licence-only service has issued. */
  licenses: () => LicenseGrant[]
  logs: () => FakeHqLog[]
  issues: () => FakeHqIssue[]
  /** Seed support summaries explicitly. No customer conversation is created by a connect. */
  seedConversation: (conversation: FakeHqConversation) => void
  /** Every request received, as `METHOD /path`. */
  requests: () => string[]
}

interface Project {
  grant: ConnectGrant
  owner: string
}

interface Licensed {
  grant: LicenseGrant
  owner: string
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function bearer(request: Request): string | null {
  return /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1] ?? null
}

export function createFakeHqService(options: FakeHqServiceOptions = {}): FakeHqService {
  const service = options.service ?? 'fakehq'
  const origin = (options.origin ?? `https://${service}.test`).replace(/\/+$/, '')
  const meters = options.meters ?? [{ meter: 'events', used: 0, limit: 500 }]
  const now = options.now ?? (() => new Date())

  const projects = new Map<string, Project>()
  const licensed = new Map<string, Licensed>()
  const codes: string[] = []
  const polls = new Map<string, number>()
  const logs: FakeHqLog[] = []
  const issues: FakeHqIssue[] = []
  const conversations: FakeHqConversation[] = []
  const requests: string[] = []
  const user = { id: 'fake-user' }

  /** Create, or reuse, the project named after the app. */
  function provision(owner: string, app: string): ConnectGrant {
    const key = `${owner}/${app}`
    let project = projects.get(key)
    if (!project) {
      const id = crypto.randomUUID()
      project = {
        owner,
        grant: {
          project: { id, name: app },
          ingestKey: `${service}_ingest_${crypto.randomUUID()}`,
          readKey: `${service}_read_${crypto.randomUUID()}`,
          dashboardUrl: `${options.relativeDashboardUrl ? '' : origin}/projects/${id}`,
        },
      }
      projects.set(key, project)
    }
    return project.grant
  }

  /** Issue, or reuse, the licence for the app. */
  function license(owner: string, app: string): LicenseGrant {
    const key = `${owner}/${app}`
    let entry = licensed.get(key)
    if (!entry) {
      const id = crypto.randomUUID()
      entry = {
        owner,
        grant: {
          project: { id, name: app },
          licenseKey: `rhq_lic_${crypto.randomUUID().replaceAll('-', '')}`,
          dashboardUrl: `${origin}/account`,
        },
      }
      licensed.set(key, entry)
    }
    return entry.grant
  }

  const hq: HqService<{ id: string }> = createHqService({
    service,
    approveUrl: code => `${origin}/cli/connect?code=${encodeURIComponent(code)}`,
    upgradeUrl: `${origin}/pricing`,
    codes: createMemoryConnectCodeStore(),
    provision: async (who, { app }) => options.license ? license(who.id, app) : provision(who.id, app),
    // A licence-only service has nothing to read usage with, so it has no usage route.
    ...(options.license
      ? {}
      : {
          async authenticateReadKey(readKey: string) {
            for (const { grant, owner } of projects.values()) {
              if (grant.readKey === readKey)
                return { owner, project: grant.project.id }
            }
            return null
          },
          usage: async () => meters.map(reading => ({ ...reading })),
        }),
  }, { now })

  const projectByIngestKey = (key: string | null): Project | undefined =>
    key ? [...projects.values()].find(project => project.grant.ingestKey === key) : undefined

  /** The real readers answer 404, not 401, for a key that does not open the project. */
  const readable = (request: Request, id: string): boolean => {
    const key = bearer(request)
    return [...projects.values()].some(project => project.grant.project.id === id && project.grant.readKey === key)
  }

  const confirmCodeOf = (code: string): string => `${code.slice(0, 3)}-${code.slice(3, 6)}`.toUpperCase()

  async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname.replace(/\/+$/, '') || '/'
    const method = request.method.toUpperCase()
    requests.push(`${method} ${path}`)

    const contractPath = path.startsWith('/api/cli/connect') || path === '/api/v1/usage'
    if (contractPath && options.contract === false)
      return json({ error: 'not found' }, 404)

    if (method === 'POST' && path === '/api/cli/connect') {
      const started = await hq.startConnect(request)
      const body = await started.json() as { code: string, approveUrl: string }
      codes.push(body.code)
      return json(options.confirmCode ? { ...body, confirmCode: confirmCodeOf(body.code) } : body, started.status)
    }

    if (method === 'GET' && path.startsWith('/api/cli/connect/')) {
      const code = decodeURIComponent(path.slice('/api/cli/connect/'.length))
      const count = (polls.get(code) ?? 0) + 1
      polls.set(code, count)
      if (options.approveOnPoll !== undefined && count === options.approveOnPoll)
        await hq.approveConnect(code, user)
      return hq.pollConnect(request, code)
    }

    if (method === 'GET' && path === '/api/v1/usage')
      return hq.usage(request)

    if (method === 'POST' && (path === '/logs' || path === '/errors')) {
      const body = await request.json().catch(() => ({})) as Record<string, unknown>
      const header = request.headers.get(path === '/logs' ? 'x-loghq-key' : 'x-bughq-key')
      const project = projectByIngestKey(header ?? (typeof body.key === 'string' ? body.key : null))
      if (!project)
        return json({ error: 'invalid ingest key' }, 401)
      const at = now().toISOString()

      if (path === '/logs') {
        const entries = Array.isArray(body.logs) ? body.logs as Record<string, unknown>[] : [body]
        const usable = entries.filter(entry => entry && entry.message != null)
        if (!usable.length)
          return json({ error: 'no log entries' }, 400)
        if (options.storeIngest !== false) {
          for (const entry of usable) {
            logs.push({
              id: crypto.randomUUID(),
              project: project.grant.project.id,
              level: String(entry.level ?? 'info'),
              message: String(entry.message),
              timestamp: String(entry.timestamp ?? at),
            })
          }
        }
        return json({ ok: true, stored: options.storeIngest === false ? 0 : usable.length, dropped: 0, skipped: entries.length - usable.length }, 201)
      }

      if (!body.message)
        return json({ error: 'missing message' }, 400)
      const type = String(body.type ?? 'Error')
      const title = `${type}: ${String(body.message).split('\n')[0]}`
      if (options.storeIngest !== false) {
        const existing = issues.find(issue => issue.project === project.grant.project.id && issue.title === title)
        if (existing) {
          existing.count += 1
          existing.last_seen = at
        }
        else {
          issues.push({
            id: crypto.randomUUID(),
            project: project.grant.project.id,
            title,
            error_type: type,
            level: String(body.level ?? 'error'),
            status: 'unresolved',
            count: 1,
            first_seen: at,
            last_seen: at,
          })
        }
      }
      // BugHQ answers 200 with `sampled` for an event it dropped.
      return options.storeIngest === false ? json({ ok: true, sampled: true }) : json({ ok: true }, 201)
    }

    const supportReader = /^\/api\/v1\/projects\/([^/]+)\/conversations$/.exec(path)
    if (method === 'GET' && supportReader) {
      const id = decodeURIComponent(supportReader[1]!)
      if (!readable(request, id))
        return json({ error: 'not found' }, 404)
      const status = url.searchParams.get('status')
      const before = url.searchParams.get('before')
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 100))
      const matching = conversations
        .filter(row => row.project === id && (!status || row.status === status) && (!before || row.updated_at < before))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      const page = matching.slice(0, limit)
      return json({
        conversations: page.map(row => ({ id: row.id, subject: row.subject, status: row.status, customer_id: row.customer_id, updated_at: row.updated_at, unread_count: row.unread_count })),
        nextCursor: matching.length > limit ? page[page.length - 1]!.updated_at : null,
      })
    }

    const reader = /^\/api\/projects\/([^/]+)\/(logs|issues)$/.exec(path)
    if (method === 'GET' && reader) {
      const id = decodeURIComponent(reader[1]!)
      if (!readable(request, id))
        return json({ error: 'not found' }, 404)

      if (reader[2] === 'logs') {
        const search = (url.searchParams.get('q') ?? '').toLowerCase()
        const levels = (url.searchParams.get('level') ?? '').split(',').filter(Boolean)
        const before = url.searchParams.get('before')
        const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 100))
        const matching = logs
          .filter(log => log.project === id)
          .filter(log => !search || log.message.toLowerCase().includes(search))
          .filter(log => !levels.length || levels.includes(log.level))
          .filter(log => !before || log.timestamp < before)
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
        const page = matching.slice(0, limit)
        return json({
          logs: page.map(log => ({ id: log.id, level: log.level, message: log.message, channel: null, environment: null, timestamp: log.timestamp, created_at: log.timestamp })),
          nextCursor: matching.length > limit ? page[page.length - 1]!.timestamp : null,
        })
      }

      const status = url.searchParams.get('status')
      return json({
        issues: issues
          .filter(issue => issue.project === id && (!status || issue.status === status))
          .map(issue => ({ ...issue, project: undefined, culprit: null })),
      })
    }

    return json({ error: 'not found' }, 404)
  }

  return {
    service,
    origin,
    fetch: (input, init) => handle(input instanceof Request ? input : new Request(String(input), init)),
    approve: async (code) => {
      const target = code ?? codes[codes.length - 1]
      return target ? hq.approveConnect(target, user) : { ok: false, reason: 'expired' }
    },
    project: (app = 'app') => provision(user.id, app),
    codes: () => [...codes],
    confirmCodeFor: code => (options.confirmCode && codes.includes(code) ? confirmCodeOf(code) : undefined),
    grants: () => [...projects.values()].map(project => project.grant),
    licenses: () => [...licensed.values()].map(entry => entry.grant),
    logs: () => [...logs],
    issues: () => [...issues],
    seedConversation: conversation => conversations.push({ ...conversation }),
    requests: () => [...requests],
  }
}

/**
 * One `fetch` over several fake services, routed by origin.
 *
 * An origin nobody answers rejects the way a real `fetch` does for a host
 * that is down, so the unreachable path can be tested too.
 */
export function fakeHqFetch(...services: FakeHqService[]): (input: string | URL | Request, init?: RequestInit) => Promise<Response> {
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    const target = services.find(candidate => candidate.origin === url.origin)
    if (!target)
      throw new TypeError(`fetch failed: nothing answers ${url.origin}`)
    return target.fetch(input, init)
  }
}
