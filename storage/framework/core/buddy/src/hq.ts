import type { HqUnavailable } from '@stacksjs/hq/client'
import type { HqConfig, HqServiceName } from '@stacksjs/types'
import { createHqClient } from '@stacksjs/hq/client'

/**
 * What `buddy hq:connect` and `buddy hq:status` do, kept apart from the
 * command file so it runs against a fake service in tests: everything that
 * touches the network, the browser, the clock, the terminal or `.env` arrives
 * through `HqCliDeps`.
 *
 * One rule governs the output: a key is never printed. Keys go from the
 * service's answer into `writeEnv` and into request headers, and nowhere else.
 */

export interface HqServiceDescriptor {
  label: string
  /** The `.env` names `hq:connect` writes this service's grant to. */
  env: { key?: string, readKey?: string, project?: string }
  /** What `hq:connect` sends and reads back to prove the keys work. */
  verify?: 'log' | 'error'
}

export const HQ_SERVICES: Record<HqServiceName, HqServiceDescriptor> = {
  bughq: { label: 'BugHQ', env: { key: 'BUGHQ_KEY', readKey: 'BUGHQ_READ_KEY', project: 'BUGHQ_PROJECT_ID' }, verify: 'error' },
  loghq: { label: 'LogHQ', env: { key: 'LOGHQ_KEY', readKey: 'LOGHQ_READ_KEY', project: 'LOGHQ_PROJECT_ID' }, verify: 'log' },
  analyticshq: { label: 'AnalyticsHQ', env: { readKey: 'ANALYTICSHQ_READ_KEY', project: 'ANALYTICSHQ_SITE_ID' } },
  statushq: { label: 'StatusHQ', env: { key: 'STATUSHQ_KEY', readKey: 'STATUSHQ_READ_KEY' } },
  commshq: { label: 'CommsHQ', env: { key: 'COMMSHQ_KEY', readKey: 'COMMSHQ_READ_KEY' } },
}

export const HQ_SERVICE_NAMES = Object.keys(HQ_SERVICES) as HqServiceName[]

/** The services `hq:connect` asks when none is named: the two that have shipped the contract. */
export const HQ_DEFAULT_SERVICES: HqServiceName[] = ['bughq', 'loghq']

export interface HqCliDeps {
  fetch: (input: string, init?: RequestInit) => Promise<Response>
  print: (line: string) => void
  /** Open a URL in the person's browser. May do nothing (no display, CI). */
  open: (url: string) => void | Promise<void>
  /** Resolves after `ms`, or as soon as `signal` aborts. */
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>
  now: () => number
  /** Persist `.env` entries. Must not echo a value. */
  writeEnv: (entries: Record<string, string>) => Promise<void>
  /** Aborts when the person cancels (Ctrl+C). */
  signal?: AbortSignal
}

export interface HqConnectOptions {
  /** The app's name; the service creates or reuses a project under it. */
  app: string
  open?: boolean
  verify?: boolean
  /** How long to wait for the approval. Default ten minutes, which is how long a code lives. */
  timeoutMs?: number
  /** Default two seconds. The services allow about two polls a second. */
  pollIntervalMs?: number
  /** How many times, a second apart, to look for a test record before calling the read a failure. */
  readAttempts?: number
}

export type HqConnectStatus
  = | 'connected'
  /** The service answered 404 on the connect route: it has not shipped the contract. */
    | 'unavailable'
    | 'unreachable'
    | 'expired'
    | 'timeout'
    | 'cancelled'
    | 'failed'

export type HqCheck = 'pass' | 'fail' | 'skipped'

export interface HqConnectOutcome {
  service: HqServiceName
  status: HqConnectStatus
  /** Why, in words for the person at the terminal. Never contains a key. */
  detail?: string
  project?: string
  dashboardUrl?: string
  send: HqCheck
  read: HqCheck
}

export interface HqConnectResult {
  outcomes: HqConnectOutcome[]
  /** False when a service that has the contract could not be connected or verified. */
  ok: boolean
}

interface Grant {
  project: { id: string, name: string }
  ingestKey: string
  readKey: string
  dashboardUrl: string
}

const REQUEST_TIMEOUT_MS = 10_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function origin(url: string): string {
  return url.replace(/\/+$/, '')
}

/** An http(s) URL, or null. A path is resolved against `base`, which is how a service may spell its own pages. */
function httpUrl(value: unknown, base?: string): string | null {
  if (typeof value !== 'string' || !value)
    return null
  try {
    const url = new URL(value, base)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  }
  catch {
    return null
  }
}

function toGrant(body: Record<string, unknown>, base: string): Grant | null {
  const project = body.project
  if (!isRecord(project) || project.id == null || typeof body.ingestKey !== 'string' || typeof body.readKey !== 'string')
    return null
  if (!body.ingestKey || !body.readKey)
    return null
  return {
    project: { id: String(project.id), name: String(project.name ?? project.id) },
    ingestKey: body.ingestKey,
    readKey: body.readKey,
    dashboardUrl: httpUrl(body.dashboardUrl, base) ?? '',
  }
}

/** A request that gives up after ten seconds, or at once when the person cancels. */
async function request(deps: HqCliDeps, url: string, init: RequestInit = {}): Promise<Response | null> {
  const signals = [AbortSignal.timeout(REQUEST_TIMEOUT_MS), ...(deps.signal ? [deps.signal] : [])]
  try {
    return await deps.fetch(url, { ...init, signal: AbortSignal.any(signals) })
  }
  catch {
    return null
  }
}

function retryAfterMs(response: Response, fallback: number): number {
  const seconds = Number(response.headers.get('retry-after'))
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 60) * 1000 : fallback
}

/** Normalise what was typed after `hq:connect` into service names, or say which one is unknown. */
export function resolveHqServices(requested: readonly string[], fallback: HqServiceName[] = HQ_DEFAULT_SERVICES): { services: HqServiceName[] } | { error: string } {
  const names = requested.map(name => name.trim().toLowerCase()).filter(Boolean)
  if (!names.length)
    return { services: [...fallback] }
  const unknown = names.filter(name => !(name in HQ_SERVICES))
  if (unknown.length)
    return { error: `Unknown service: ${unknown.join(', ')}. Choose from ${HQ_SERVICE_NAMES.join(', ')}.` }
  return { services: [...new Set(names)] as HqServiceName[] }
}

async function connectOne(service: HqServiceName, url: string, options: HqConnectOptions, deps: HqCliDeps): Promise<{ outcome: HqConnectOutcome, grant?: Grant }> {
  const { label } = HQ_SERVICES[service]
  const base = origin(url)
  const outcome = (status: HqConnectStatus, detail?: string): { outcome: HqConnectOutcome } =>
    ({ outcome: { service, status, detail, send: 'skipped', read: 'skipped' } })

  const started = await request(deps, `${base}/api/cli/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ app: options.app }),
  })
  if (deps.signal?.aborted)
    return outcome('cancelled', 'cancelled')
  if (!started)
    return outcome('unreachable', `could not reach ${base}`)
  if (started.status === 404 || started.status === 405)
    return outcome('unavailable', 'not available yet')
  if (started.status === 429)
    return outcome('failed', 'too many requests, try again in a minute')
  if (!started.ok)
    return outcome('failed', `the service answered ${started.status}`)

  const body = await started.json().catch(() => null)
  const code = isRecord(body) && typeof body.code === 'string' && /^[\w-]{16,128}$/.test(body.code) ? body.code : null
  const approveUrl = isRecord(body) ? httpUrl(body.approveUrl, base) : null
  if (!code || !approveUrl)
    return outcome('failed', 'the service answered something that is not a connect code')
  const confirmCode = isRecord(body) && typeof body.confirmCode === 'string' && /^[\w-]{1,32}$/.test(body.confirmCode) ? body.confirmCode : null

  deps.print('')
  deps.print(`${label}: approve this connection in your browser`)
  deps.print(`  ${approveUrl}`)
  if (confirmCode)
    deps.print(`  Confirmation code: ${confirmCode} (type it on that page)`)
  deps.print('  If the page asks you to sign in, sign in and open the link again.')
  deps.print('  Waiting for approval. Press Ctrl+C to cancel.')

  if (options.open !== false) {
    try {
      await deps.open(approveUrl)
    }
    catch { /* the URL is on screen; opening it is a convenience */ }
  }

  const interval = options.pollIntervalMs ?? 2000
  const deadline = deps.now() + (options.timeoutMs ?? 10 * 60 * 1000)
  const pollUrl = `${base}/api/cli/connect/${encodeURIComponent(code)}`

  while (true) {
    if (deps.signal?.aborted)
      return outcome('cancelled', 'cancelled')
    if (deps.now() >= deadline)
      return outcome('timeout', 'nobody approved it in time')

    await deps.sleep(Math.min(interval, Math.max(0, deadline - deps.now())), deps.signal)
    if (deps.signal?.aborted)
      return outcome('cancelled', 'cancelled')

    const polled = await request(deps, pollUrl, { headers: { Accept: 'application/json' } })
    // A dropped request while waiting is not the end: the code is still good.
    if (!polled)
      continue
    if (polled.status === 429) {
      await deps.sleep(retryAfterMs(polled, interval), deps.signal)
      continue
    }
    if (polled.status === 404)
      return outcome('expired', 'the request expired, run the command again')
    if (!polled.ok)
      return outcome('failed', `the service answered ${polled.status}`)

    const answer = await polled.json().catch(() => null)
    if (!isRecord(answer) || answer.status === 'pending')
      continue
    if (answer.status === 'expired')
      return outcome('expired', 'the request expired, run the command again')

    const grant = toGrant(answer, base)
    if (!grant)
      return outcome('failed', 'the service approved the request without sending keys')
    return {
      grant,
      outcome: { service, status: 'connected', project: grant.project.name, dashboardUrl: grant.dashboardUrl || undefined, send: 'skipped', read: 'skipped' },
    }
  }
}

function envEntries(service: HqServiceName, grant: Grant): Record<string, string> {
  const names = HQ_SERVICES[service].env
  const entries: Record<string, string> = {}
  if (names.key)
    entries[names.key] = grant.ingestKey
  if (names.readKey)
    entries[names.readKey] = grant.readKey
  if (names.project)
    entries[names.project] = grant.project.id
  return entries
}

/** Send one test record with the ingest key and find it again with the read key. */
async function verify(service: HqServiceName, url: string, grant: Grant, options: HqConnectOptions, deps: HqCliDeps): Promise<{ send: HqCheck, read: HqCheck, detail?: string }> {
  const kind = HQ_SERVICES[service].verify
  if (!kind)
    return { send: 'skipped', read: 'skipped' }

  const base = origin(url)
  const marker = `hq-connect-${crypto.randomUUID().slice(0, 8)}`
  const message = `buddy hq:connect test ${marker}`
  const timestamp = new Date(deps.now()).toISOString()

  const sent = kind === 'log'
    ? await request(deps, `${base}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-LogHQ-Key': grant.ingestKey },
        body: JSON.stringify({ logs: [{ level: 'info', message, timestamp, context: { source: 'buddy hq:connect' } }] }),
      })
    : await request(deps, `${base}/errors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: grant.ingestKey, type: 'HqConnectTest', message, level: 'info', environment: 'hq-connect', timestamp, sdk: { name: 'buddy.hq-connect' } }),
      })
  if (!sent?.ok)
    return { send: 'fail', read: 'skipped', detail: sent ? `sending the test ${kind} answered ${sent.status}` : `sending the test ${kind} did not get through` }

  // Past its allowance a service still answers 2xx and keeps one record in
  // ten. BugHQ says `sampled`, LogHQ says it stored none. The keys work; there
  // is just nothing to read back.
  const receipt = await sent.json().catch(() => null)
  if (isRecord(receipt) && (receipt.sampled === true || receipt.stored === 0))
    return { send: 'pass', read: 'skipped', detail: `the plan allowance is used up, so the test ${kind} was not kept` }

  const client = createHqClient({
    services: { [service]: { url: base, readKey: grant.readKey, project: grant.project.id } },
    timeoutMs: REQUEST_TIMEOUT_MS,
    fetch: (input, init) => deps.fetch(input, init),
  })

  let reason = `the test ${kind} was accepted but did not show up`
  const attempts = options.readAttempts ?? 5
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0)
      await deps.sleep(1000, deps.signal)
    if (deps.signal?.aborted)
      return { send: 'pass', read: 'fail', detail: 'cancelled' }

    if (kind === 'log') {
      const page = await client.logs.list({ search: marker, limit: 5 })
      if (page.ok && page.data.logs.some(log => log.message.includes(marker)))
        return { send: 'pass', read: 'pass' }
      if (!page.ok)
        reason = describeUnavailable(page)
    }
    else {
      const list = await client.issues.list()
      if (list.ok && list.data.some(issue => issue.title.includes(marker)))
        return { send: 'pass', read: 'pass' }
      if (!list.ok)
        reason = describeUnavailable(list)
    }
  }
  return { send: 'pass', read: 'fail', detail: reason }
}

/** Why a read came back empty, for the person at the terminal. */
export function describeUnavailable(result: HqUnavailable): string {
  switch (result.reason) {
    case 'not_configured': return 'not connected'
    case 'unauthorized': return 'the read key was refused'
    case 'timeout': return 'the service did not answer in time'
    case 'network': return 'the service could not be reached'
    case 'http': return result.status === 404 ? 'not available yet' : `the service answered ${result.status}`
    case 'bad_response': return 'the service answered something unexpected'
  }
}

export function renderTable(headers: string[], rows: string[][]): string[] {
  const widths = headers.map((header, column) => Math.max(header.length, ...rows.map(row => (row[column] ?? '').length)))
  const line = (cells: string[]): string => cells.map((cell, column) => (cell ?? '').padEnd(widths[column]!)).join('  ').trimEnd()
  return [line(headers), line(widths.map(width => '-'.repeat(width))), ...rows.map(line)]
}

const CONNECT_WORDS: Record<HqConnectStatus, string> = {
  connected: 'pass',
  unavailable: 'not available yet',
  unreachable: 'fail',
  expired: 'fail',
  timeout: 'fail',
  cancelled: 'cancelled',
  failed: 'fail',
}

const CHECK_WORDS: Record<HqCheck, string> = { pass: 'pass', fail: 'fail', skipped: '-' }

export function connectTable(outcomes: HqConnectOutcome[]): string[] {
  return renderTable(
    ['Service', 'Connect', 'Send', 'Read back', 'Note'],
    outcomes.map(outcome => [
      HQ_SERVICES[outcome.service].label,
      CONNECT_WORDS[outcome.status],
      CHECK_WORDS[outcome.send],
      CHECK_WORDS[outcome.read],
      outcome.status === 'unavailable' ? '' : outcome.detail ?? '',
    ]),
  )
}

/**
 * Connect each service in turn. A service that fails, or has not shipped the
 * contract, never stops the ones after it; only a cancel does.
 */
export async function runHqConnect(services: HqServiceName[], config: HqConfig, options: HqConnectOptions, deps: HqCliDeps): Promise<HqConnectResult> {
  const outcomes: HqConnectOutcome[] = []

  for (const service of services) {
    const { label } = HQ_SERVICES[service]
    if (deps.signal?.aborted) {
      outcomes.push({ service, status: 'cancelled', detail: 'cancelled', send: 'skipped', read: 'skipped' })
      continue
    }

    const url = config[service]?.url
    if (!url) {
      outcomes.push({ service, status: 'failed', detail: 'no URL is configured in config/hq.ts', send: 'skipped', read: 'skipped' })
      continue
    }

    const { outcome, grant } = await connectOne(service, url, options, deps)
    if (!grant) {
      if (outcome.status === 'unavailable')
        deps.print(`${label}: not available yet`)
      else if (outcome.status !== 'cancelled')
        deps.print(`${label}: not connected (${outcome.detail})`)
      outcomes.push(outcome)
      continue
    }

    try {
      await deps.writeEnv(envEntries(service, grant))
    }
    catch (error) {
      // The message is the file system's, never the value's.
      const why = error instanceof Error ? error.message : 'unknown error'
      deps.print(`${label}: approved, but the keys could not be written to .env (${why})`)
      outcomes.push({ ...outcome, status: 'failed', detail: 'the keys could not be written to .env' })
      continue
    }
    deps.print(`${label}: connected to project "${grant.project.name}". Keys written to .env.`)
    if (grant.dashboardUrl)
      deps.print(`  Dashboard: ${grant.dashboardUrl}`)

    if (options.verify === false) {
      outcomes.push(outcome)
      continue
    }
    outcomes.push({ ...outcome, ...await verify(service, url, grant, options, deps) })
  }

  if (deps.signal?.aborted)
    deps.print('Cancelled. Services already connected keep their keys.')

  deps.print('')
  for (const line of connectTable(outcomes))
    deps.print(line)

  const ok = outcomes.every(outcome =>
    outcome.status === 'unavailable'
    || (outcome.status === 'connected' && outcome.send !== 'fail' && outcome.read !== 'fail'))
  return { outcomes, ok }
}

export interface HqStatusRow {
  service: HqServiceName
  meter?: string
  used?: number
  limit?: number | null
  period?: string
  state?: string
  /** Set once usage is at 80 percent of the allowance or more. */
  upgradeUrl?: string
  /** Why there is no usage to show. */
  unavailable?: string
}

const count = (value: number): string => value.toLocaleString('en-US')

/** Usage against each connected service's allowance. A service with no read key is not connected and is left out. */
export async function runHqStatus(config: HqConfig, deps: Pick<HqCliDeps, 'fetch' | 'print'>, services: HqServiceName[] = HQ_SERVICE_NAMES): Promise<HqStatusRow[]> {
  const connected = services.filter(service => config[service]?.url && config[service]?.readKey)
  if (!connected.length) {
    deps.print('No HQ service is connected yet. Run `buddy hq:connect` to connect one.')
    return []
  }

  const client = createHqClient({
    services: Object.fromEntries(connected.map(service => [service, { url: config[service]!.url, readKey: config[service]!.readKey! }])),
    timeoutMs: REQUEST_TIMEOUT_MS,
    fetch: (input, init) => deps.fetch(input, init),
  })

  const rows: HqStatusRow[] = []
  for (const [index, usage] of (await Promise.all(connected.map(service => client.getUsage(service)))).entries()) {
    const service = connected[index]!
    if (!usage.ok) {
      rows.push({ service, unavailable: describeUnavailable(usage) })
      continue
    }
    if (!usage.data.length)
      rows.push({ service, unavailable: 'no meters reported' })
    for (const report of usage.data) {
      const over = report.limit !== null && report.limit > 0 && report.used / report.limit >= 0.8
      rows.push({
        service,
        meter: report.meter,
        used: report.used,
        limit: report.limit,
        period: report.period,
        state: report.state,
        ...(over ? { upgradeUrl: report.upgradeUrl } : {}),
      })
    }
  }

  const table = renderTable(
    ['Service', 'Meter', 'Used', 'Limit', 'Period', 'State'],
    rows.map(row => row.unavailable
      ? [HQ_SERVICES[row.service].label, row.unavailable]
      : [
          HQ_SERVICES[row.service].label,
          row.meter!,
          count(row.used!),
          row.limit === null ? 'unlimited' : count(row.limit!),
          row.period!,
          row.state!,
        ]),
  )
  for (const line of table)
    deps.print(line)

  const upgrades = rows.filter(row => row.upgradeUrl)
  if (upgrades.length)
    deps.print('')
  for (const row of upgrades) {
    const percent = Math.round((row.used! / row.limit!) * 100)
    deps.print(`${HQ_SERVICES[row.service].label} ${row.meter} is at ${percent}% of its allowance. Upgrade: ${row.upgradeUrl}`)
  }
  return rows
}
