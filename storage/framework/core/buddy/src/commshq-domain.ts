/**
 * The sending domain of an app connected to CommsHQ.
 *
 * Connecting gives an app a key to send mail with. For that mail to come from
 * the app's own address (`noreply@votescape.org`) and be believed, the domain
 * has to say two things in DNS: that this app's owner controls it, and which
 * key signs its mail. CommsHQ issues both records; this publishes them through
 * the app's own DNS provider and asks CommsHQ to look. Nobody opens a
 * dashboard.
 *
 * It runs after `buddy hq:connect commshq` and again on every deploy, where it
 * is a no-op once the domain is verified. Until then CommsHQ sends from an
 * address of its own, so nothing ever leaves unauthenticated under the app's
 * domain.
 *
 * Publishing is additive. A record is created when it is missing and nothing
 * is changed or removed: the app's zone holds records this knows nothing
 * about, and its existing SPF is left alone, since mail sent this way is
 * authenticated by its signature and not by the app's SPF record.
 */

export interface SendingDomainRecord {
  type: 'TXT'
  /** The full name: `commshq._domainkey.votescape.org`. */
  name: string
  content: string
  /** What the record is for, as CommsHQ names it: `ownership`, `dkim`, `dmarc`. */
  purpose: string
}

export interface SendingDomainState {
  domain: string
  status: 'pending' | 'verified' | 'failed' | 'disabled'
  /** The address mail is sent from now: the app's own once verified, CommsHQ's until then. */
  from?: string
  records: SendingDomainRecord[]
  /** Which records CommsHQ found when it last looked, by purpose. */
  checks?: Record<string, boolean>
}

export interface PublishResult {
  /** The provider that holds the zone, or null when none of the configured ones does. */
  provider: string | null
  created: number
  kept: number
  failures: Array<{ name: string, reason: string }>
}

export interface SendingDomainDeps {
  fetch: (input: string, init?: RequestInit) => Promise<Response>
  /** Publish records in `zone`, creating what is missing and changing nothing else. */
  publish: (zone: string, records: SendingDomainRecord[]) => Promise<PublishResult>
  print: (line: string) => void
  sleep: (ms: number) => Promise<void>
}

export interface SendingDomainOptions {
  /** CommsHQ's origin. */
  url: string
  /** The app's send key. */
  key: string
  /** The domain mail should come from. */
  domain: string
  /** The zone the domain's records live in, where it is not the domain itself. */
  zone?: string
  /** How many times to ask CommsHQ to look, a few seconds apart. DNS takes a moment. Default 3. */
  verifyAttempts?: number
  /** Default five seconds. */
  verifyIntervalMs?: number
}

export interface SendingDomainOutcome {
  status: 'verified' | 'pending' | 'skipped' | 'failed'
  domain?: string
  detail?: string
  published?: PublishResult
}

/**
 * The domain an app's mail should come from: the one in its From address,
 * else the one it is served on. Undefined for a local or placeholder address.
 */
export function sendingDomainFor(input: { mailFrom?: string, appUrl?: string }): string | undefined {
  const plain = (host: string | undefined): string | undefined => {
    const name = String(host || '').trim().toLowerCase().replace(/\.$/, '').replace(/^www\./, '')
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]*[a-z0-9]$/.test(name))
      return undefined
    // Not somewhere mail can come from.
    if (/(?:^|\.)(?:localhost|test|example|invalid|local)$/.test(name) || /^example\.(?:com|org|net)$/.test(name))
      return undefined
    return name
  }

  const at = String(input.mailFrom || '').lastIndexOf('@')
  const fromAddress = at > 0 ? plain(String(input.mailFrom).slice(at + 1)) : undefined
  if (fromAddress)
    return fromAddress

  try {
    const url = String(input.appUrl || '')
    return plain(new URL(/^https?:\/\//.test(url) ? url : `https://${url}`).hostname)
  }
  catch {
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** What CommsHQ answered, checked: a record this is asked to publish must sit inside the domain. */
export function parseSendingDomain(body: unknown, domain: string): SendingDomainState | null {
  const data = isRecord(body) && isRecord(body.data) ? body.data : body
  if (!isRecord(data) || typeof data.domain !== 'string' || data.domain.toLowerCase() !== domain)
    return null
  const status = String(data.status)
  if (!['pending', 'verified', 'failed', 'disabled'].includes(status))
    return null

  const records: SendingDomainRecord[] = []
  for (const record of Array.isArray(data.records) ? data.records : []) {
    if (!isRecord(record) || record.type !== 'TXT' || typeof record.name !== 'string' || typeof record.content !== 'string')
      continue
    const name = record.name.toLowerCase().replace(/\.$/, '')
    // A service is trusted to say what to publish under the app's sending
    // domain and nowhere else in the app's zone.
    if (name !== domain && !name.endsWith(`.${domain}`))
      continue
    if (!record.content || record.content.length > 2048 || /[\r\n]/.test(record.content))
      continue
    records.push({ type: 'TXT', name, content: record.content, purpose: String(record.purpose || 'record') })
  }

  return {
    domain,
    status: status as SendingDomainState['status'],
    from: typeof data.from === 'string' ? data.from : undefined,
    records,
    checks: isRecord(data.checks) ? Object.fromEntries(Object.entries(data.checks).map(([key, value]) => [key, value === true])) : undefined,
  }
}

async function call(deps: SendingDomainDeps, options: SendingDomainOptions, path: string): Promise<{ status: number, body: unknown } | null> {
  try {
    const response = await deps.fetch(`${options.url.replace(/\/+$/, '')}${path}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${options.key}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ domain: options.domain }),
      signal: AbortSignal.timeout(15_000),
    })
    return { status: response.status, body: await response.json().catch(() => null) }
  }
  catch {
    return null
  }
}

/**
 * Register the app's sending domain with CommsHQ, publish its records, and
 * have CommsHQ check them. Never throws: a deploy that shipped is not failed
 * by its mail's DNS.
 */
export async function setUpSendingDomain(options: SendingDomainOptions, deps: SendingDomainDeps): Promise<SendingDomainOutcome> {
  const domain = options.domain.toLowerCase()
  const say = (line: string): void => deps.print(`  ${line}`)

  const registered = await call(deps, options, '/api/v1/sending-domain')
  if (!registered)
    return { status: 'failed', domain, detail: 'CommsHQ could not be reached' }
  if (registered.status === 404)
    return { status: 'skipped', domain, detail: 'this CommsHQ does not set up sending domains yet' }
  const state = parseSendingDomain(registered.body, domain)
  if (!state) {
    const error = isRecord(registered.body) && typeof registered.body.error === 'string' ? registered.body.error : `the service answered ${registered.status}`
    return { status: 'failed', domain, detail: error }
  }

  if (state.status === 'verified') {
    say(`Mail is sent from ${domain}, signed with its own key.`)
    return { status: 'verified', domain }
  }
  if (state.status === 'disabled')
    return { status: 'failed', domain, detail: `${domain} is disabled in CommsHQ` }

  const published = await deps.publish(options.zone || domain, state.records)
  if (!published.provider) {
    say(`No DNS provider this project is configured with holds ${domain}. Publish these records, then deploy or run the connect again:`)
    for (const record of state.records)
      say(`  TXT ${record.name}  ${record.content}`)
    return { status: 'pending', domain, detail: 'the DNS records are not published', published }
  }
  say(`${domain}: ${published.created} DNS record(s) published through ${published.provider}, ${published.kept} already there.`)
  for (const failure of published.failures)
    say(`  could not publish ${failure.name}: ${failure.reason}`)

  const attempts = Math.max(1, options.verifyAttempts ?? 3)
  let checked: SendingDomainState | null = null
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const answer = await call(deps, options, '/api/v1/sending-domain/verify')
    checked = answer ? parseSendingDomain(answer.body, domain) : null
    if (checked?.status === 'verified')
      break
    if (attempt < attempts)
      await deps.sleep(options.verifyIntervalMs ?? 5000)
  }

  if (checked?.status === 'verified') {
    say(`${domain} is verified. Mail is now sent from it, signed with its own key.`)
    return { status: 'verified', domain, published }
  }

  const missing = Object.entries(checked?.checks ?? {}).filter(([, found]) => !found).map(([purpose]) => purpose)
  say(`${domain} is not verified yet${missing.length ? ` (not seen in DNS: ${missing.join(', ')})` : ''}. DNS can take a few minutes. Until it is, mail goes out from ${checked?.from || state.from || 'a CommsHQ address'}, and the next deploy checks again.`)
  return { status: 'pending', domain, detail: 'waiting for DNS', published }
}
