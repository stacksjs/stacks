import type { DnsConfig } from '@stacksjs/types'
import type { DnsProvider, DnsRecord, DnsRecordType } from '@stacksjs/ts-cloud'
import { promises as resolver } from 'node:dns'
import { DnsProviderFactory } from '@stacksjs/ts-cloud'

/**
 * Declarative DNS reconciliation for a Stacks app's `config/dns.ts`.
 *
 * Two halves, both provider-agnostic (Route53 / Porkbun / GoDaddy / Cloudflare
 * via ts-cloud's `DnsProvider`):
 *   - `pull`  — read a zone's live records (public resolver, no credentials) and
 *               render them as a `config/dns.ts` source block.
 *   - `sync`  — reconcile `config/dns.ts` to the registrar, strictly ADDITIVELY:
 *               only ever CREATE a declared record that is missing; never delete
 *               a record and never overwrite an existing one. Single-valued
 *               records (A/AAAA/CNAME) are left as-is when present (so an
 *               apex A the deploy manages is never clobbered); multi-valued
 *               records (TXT/MX) are added only when an identical one is absent.
 */

// A/AAAA/CNAME hold a single value per name; TXT/MX can coexist.
const SINGLE_VALUED: ReadonlySet<string> = new Set<string>(['A', 'AAAA', 'CNAME'])

function ttlNumber(ttl: number | 'auto' | undefined): number {
  const n = ttl === 'auto' || ttl == null ? 600 : ttl
  return Math.max(600, n) // registrars such as Porkbun enforce a 600s minimum
}

/**
 * Resolve a `config/dns.ts` record name to the FQDN it names inside `domain`.
 *
 * `@` and `''` are the apex, which is the documented way to write it. Two
 * other spellings reach here from real configs and used to be treated as
 * relative labels, which silently doubled the zone: the framework's own
 * scaffold wrote `name: env.APP_DOMAIN`, and `stacksjs.com` under zone
 * `stacksjs.com` became `stacksjs.com.stacksjs.com`. A name already inside the
 * zone, or written absolute with a trailing dot, is taken as-is.
 */
function toFqdn(domain: string, name: string): string {
  const zone = normalizeName(domain)

  if (name === '@' || name === '')
    return domain

  // Trailing dot is the DNS convention for "this is already absolute".
  if (name.endsWith('.'))
    return normalizeName(name)

  const normalized = normalizeName(name)
  if (normalized === zone || normalized.endsWith(`.${zone}`))
    return normalized

  return `${name}.${domain}`
}

function normalizeName(name: string): string {
  return name.replace(/\.$/, '').toLowerCase()
}

// Some registrars return TXT content wrapped in quotes; compare unwrapped.
function unquote(value: string): string {
  return value.replace(/^"(.*)"$/s, '$1')
}

// Never publish a private/loopback/link-local/placeholder address to public DNS
// (guards against, e.g., the framework-default config/dns.ts 10.0.0.1 sample).
function isPublishable(record: DnsRecord): boolean {
  if (record.type === 'A')
    return !/^(?:0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(record.content)
  if (record.type === 'AAAA')
    return !/^(?:::1$|fe80:|f[cd])/i.test(record.content)
  return true
}

/**
 * The address `@` copies: the apex A (or AAAA) declared in the same config.
 *
 * `{ name: 'www', address: '@' }` means "www points where the apex points",
 * which is how registrar UIs spell it and how the framework scaffold shipped
 * it. It is NOT valid record content: sent verbatim, a registrar API rejects
 * `@` as an address, which is exactly what happened on every deploy of an app
 * that kept the scaffold. Resolve it here, or leave it in place for the
 * planner to skip with a reason.
 */
function apexAddress(domain: string, cfg: DnsConfig, type: 'A' | 'AAAA'): string | null {
  const entries = (type === 'A' ? cfg.a : cfg.aaaa) ?? []

  for (const entry of entries) {
    if (toFqdn(domain, entry.name) !== normalizeName(domain))
      continue
    if (!entry.address || entry.address === '@')
      continue

    return entry.address
  }

  return null
}

/**
 * Flatten a `config/dns.ts` `DnsConfig` into the provider's record shape.
 * `nameservers` are delegation, not zone records, so they are not included.
 */
export function desiredDnsRecords(domain: string, cfg: DnsConfig): DnsRecord[] {
  const out: DnsRecord[] = []
  const address = (value: string, type: 'A' | 'AAAA'): string =>
    value === '@' ? (apexAddress(domain, cfg, type) ?? '@') : value

  for (const r of cfg.txt ?? [])
    out.push({ name: toFqdn(domain, r.name), type: 'TXT', content: r.content, ttl: ttlNumber(r.ttl) })
  for (const r of cfg.a ?? [])
    out.push({ name: toFqdn(domain, r.name), type: 'A', content: address(r.address, 'A'), ttl: ttlNumber(r.ttl) })
  for (const r of cfg.aaaa ?? [])
    out.push({ name: toFqdn(domain, r.name), type: 'AAAA', content: address(r.address, 'AAAA'), ttl: ttlNumber(r.ttl) })
  for (const r of cfg.cname ?? [])
    // A CNAME to `@` is an alias to the apex, and the apex is a name, so this
    // one resolves without needing an address to copy.
    out.push({ name: toFqdn(domain, r.name), type: 'CNAME', content: r.target === '@' ? domain : r.target, ttl: ttlNumber(r.ttl) })
  for (const r of cfg.mx ?? [])
    out.push({ name: toFqdn(domain, r.name), type: 'MX', content: r.mailServer, ttl: ttlNumber(r.ttl), priority: r.priority })
  return out
}

export interface DnsPlanItem {
  record: DnsRecord
  action: 'create' | 'keep' | 'skip'
  /** Why a skipped record cannot be published. Set only for `skip`. */
  reason?: string
}

export interface DnsSkippedRecord {
  record: DnsRecord
  reason: string
}

export interface DnsPlan {
  items: DnsPlanItem[]
  create: DnsRecord[]
  keep: DnsRecord[]
  /** Declared records that cannot be published, each with the reason why. */
  skip: DnsSkippedRecord[]
}

/**
 * Why a declared record cannot be published, or null when it can.
 *
 * These used to be folded into `keep`, which reads as "already present" and is
 * how a placeholder address and a genuinely-satisfied record became
 * indistinguishable in the summary line. A record nobody can publish is its own
 * outcome and says so.
 */
function skipReason(record: DnsRecord, zone?: string): string | null {
  if ((record.type === 'A' || record.type === 'AAAA') && record.content === '@')
    return `address "@" copies the apex ${record.type} record, and config/dns.ts declares none`

  if (!isPublishable(record))
    return `${record.content} is a private, loopback or placeholder address and is never published`

  if (zone) {
    const name = normalizeName(record.name)
    const normalizedZone = normalizeName(zone)
    if (name !== normalizedZone && !name.endsWith(`.${normalizedZone}`))
      return `${record.name} is outside the ${zone} zone`
  }

  return null
}

/**
 * Build the additive reconciliation plan: which declared records are missing
 * (create), which are already satisfied (keep), and which cannot be published
 * at all (skip). Never plans a delete or an overwrite.
 */
export function planDnsSync(desired: DnsRecord[], current: DnsRecord[], options: { zone?: string } = {}): DnsPlan {
  const items: DnsPlanItem[] = desired.map((want) => {
    const reason = skipReason(want, options.zone)
    if (reason)
      return { record: want, action: 'skip' as const, reason }

    const name = normalizeName(want.name)
    const sameNameType = current.filter(c => c.type === want.type && normalizeName(c.name) === name)
    const present = SINGLE_VALUED.has(want.type)
      ? sameNameType.length > 0
      : sameNameType.some(c => unquote(c.content) === unquote(want.content))

    // Only create a genuinely-missing record; an existing one is left exactly
    // as it is (never delete, never overwrite).
    return { record: want, action: present ? 'keep' as const : 'create' as const }
  })

  return {
    items,
    create: items.filter(i => i.action === 'create').map(i => i.record),
    keep: items.filter(i => i.action === 'keep').map(i => i.record),
    skip: items.filter(i => i.action === 'skip').map(i => ({ record: i.record, reason: i.reason ?? 'not publishable' })),
  }
}

/**
 * Read a zone's live records over public DNS (no registrar credentials). Used by
 * `pull`, and by `sync`/`diff` as a fallback when no provider is configured.
 */
export async function resolveLiveRecords(domain: string): Promise<DnsRecord[]> {
  const settle = async <T>(p: Promise<T>): Promise<T | []> => p.catch(() => [] as unknown as T)
  const [apex, www, aaaa, txt, mx, ns] = await Promise.all([
    settle(resolver.resolve4(domain)),
    settle(resolver.resolve4(`www.${domain}`)),
    settle(resolver.resolve6(domain)),
    settle(resolver.resolveTxt(domain)),
    settle(resolver.resolveMx(domain)),
    settle(resolver.resolveNs(domain)),
  ])

  const out: DnsRecord[] = []
  for (const ip of apex as string[]) out.push({ name: domain, type: 'A', content: ip, ttl: 600 })
  for (const ip of www as string[]) out.push({ name: `www.${domain}`, type: 'A', content: ip, ttl: 600 })
  for (const ip of aaaa as string[]) out.push({ name: domain, type: 'AAAA', content: ip, ttl: 600 })
  for (const chunks of txt as string[][]) out.push({ name: domain, type: 'TXT', content: chunks.join(''), ttl: 600 })
  for (const record of mx as { priority: number, exchange: string }[]) out.push({ name: domain, type: 'MX', content: record.exchange, ttl: 600, priority: record.priority })
  for (const server of ns as string[]) out.push({ name: domain, type: 'NS', content: server, ttl: 600 })
  return out
}

/**
 * Resolve a registrar provider for a domain from environment credentials
 * (`PORKBUN_API_KEY`/`PORKBUN_SECRET_KEY`, AWS, GoDaddy, Cloudflare). Returns
 * null when no configured provider can manage the domain.
 */
export async function dnsProviderForDomain(domain: string): Promise<DnsProvider | null> {
  try {
    return await new DnsProviderFactory().loadFromEnv().getProviderForDomain(domain)
  }
  catch {
    // A misconfigured provider (e.g. invalid AWS creds) must not crash the
    // command — treat "can't determine a provider" as none configured.
    return null
  }
}

function hostOf(domain: string, fqdn: string): string {
  const name = normalizeName(fqdn)
  if (name === normalizeName(domain)) return '@'
  return name.endsWith(`.${normalizeName(domain)}`) ? name.slice(0, -(domain.length + 1)) : name
}

/**
 * Render a set of records as a `config/dns.ts` source block (used by `pull`).
 */
export function renderDnsConfig(domain: string, records: DnsRecord[]): string {
  const byType = (t: DnsRecordType): DnsRecord[] => records.filter(r => r.type === t)
  const lines: string[] = [
    `import type { DnsConfig } from '@stacksjs/types'`,
    ``,
    `// Records for ${domain}, pulled from live DNS via \`buddy dns:pull\`.`,
    `const dns: DnsConfig = {`,
  ]

  const a = [...byType('A'), ...byType('AAAA')]
  if (a.length) {
    lines.push(`  a: [`)
    for (const r of byType('A')) lines.push(`    { name: '${hostOf(domain, r.name)}', address: '${r.content}', ttl: 600 },`)
    lines.push(`  ],`)
    const aaaa = byType('AAAA')
    if (aaaa.length) {
      lines.push(`  aaaa: [`)
      for (const r of aaaa) lines.push(`    { name: '${hostOf(domain, r.name)}', address: '${r.content}', ttl: 600 },`)
      lines.push(`  ],`)
    }
  }
  const cname = byType('CNAME')
  if (cname.length) {
    lines.push(`  cname: [`)
    for (const r of cname) lines.push(`    { name: '${hostOf(domain, r.name)}', target: '${r.content}', ttl: 'auto' },`)
    lines.push(`  ],`)
  }
  const txt = byType('TXT')
  if (txt.length) {
    lines.push(`  txt: [`)
    for (const r of txt) lines.push(`    { name: '${hostOf(domain, r.name)}', ttl: 'auto', content: ${JSON.stringify(unquote(r.content))} },`)
    lines.push(`  ],`)
  }
  const mx = byType('MX')
  if (mx.length) {
    lines.push(`  mx: [`)
    for (const r of mx) lines.push(`    { name: '${hostOf(domain, r.name)}', mailServer: '${r.content}', ttl: 'auto', priority: ${r.priority ?? 10} },`)
    lines.push(`  ],`)
  }
  const ns = byType('NS')
  if (ns.length)
    lines.push(`  nameservers: [${ns.map(r => `'${normalizeName(r.content)}'`).join(', ')}],`)

  lines.push(`}`, ``, `export default dns`, ``)
  return lines.join('\n')
}

export interface DnsSyncFailure {
  record: DnsRecord
  /** What the registrar said, or the thrown error. Never empty. */
  reason: string
}

export interface DnsSyncResult {
  plan: DnsPlan
  created: number
  kept: number
  failed: number
  /** One entry per failed create, with the registrar's own reason. */
  failures: DnsSyncFailure[]
  /** Declared records that could not be published at all, and why. */
  skipped: DnsSkippedRecord[]
  applied: boolean
  provider: string | null
}

/**
 * Additively reconcile a `config/dns.ts` to a domain's registrar. Current state
 * is read from the provider when credentials are available, else from public
 * DNS. With `dryRun` (or no provider) it computes the plan without writing.
 */
export async function syncDnsConfig(
  domain: string,
  cfg: DnsConfig,
  options: { dryRun?: boolean, provider?: DnsProvider | null } = {},
): Promise<DnsSyncResult> {
  const desired = desiredDnsRecords(domain, cfg)
  // Only reach for a registrar provider (credentials) when actually applying;
  // dry runs read current state from public DNS, so they need no credentials.
  const provider = options.dryRun ? null : (options.provider ?? (await dnsProviderForDomain(domain)))
  const current = provider ? (await provider.listRecords(domain)).records ?? [] : await resolveLiveRecords(domain)
  const plan = planDnsSync(desired, current, { zone: domain })

  if (options.dryRun || !provider) {
    return {
      plan,
      created: 0,
      kept: plan.keep.length,
      failed: 0,
      failures: [],
      skipped: plan.skip,
      applied: false,
      provider: provider?.name ?? null,
    }
  }

  let created = 0
  // A count alone cannot be acted on. This used to be `catch { failed += 1 }`,
  // so a deploy could only ever say "1 failed" - not which record, not why -
  // and the one thing needed to fix it was the thing being discarded.
  const failures: DnsSyncFailure[] = []
  for (const record of plan.create) {
    try {
      const result = await provider.createRecord(domain, record)
      if (result.success)
        created += 1
      else
        failures.push({ record, reason: result.message?.trim() || `${provider.name} rejected the record without a message` })
    }
    catch (err) {
      failures.push({ record, reason: err instanceof Error ? err.message : String(err) })
    }
  }

  return {
    plan,
    created,
    kept: plan.keep.length,
    failed: failures.length,
    failures,
    skipped: plan.skip,
    applied: true,
    provider: provider.name,
  }
}
