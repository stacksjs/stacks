/**
 * `buddy doctor`'s mail DNS checks: can a deploy publish this app's mail
 * records, are they actually live, and is the domain in Gmail Postmaster
 * Tools.
 *
 * The deploy publishes MX, SPF, DKIM and DMARC through whichever DNS provider
 * holds the mail domain's zone, and when none it can reach does, it prints
 * the records for a human instead. That fallback is easy to miss for months:
 * stacksjs.com's zone is on Cloudflare, the project carried no
 * CLOUDFLARE_API_TOKEN, and no deploy ever published its mail records. These
 * checks say so without a deploy, from public DNS and the names of the keys
 * in the production env file - never a value, and never over SSH.
 *
 * The describe functions are pure so their verdicts are testable; the
 * network half (`gatherMailDnsFacts`) is a handful of public lookups with a
 * short timeout each.
 */
import type { DnsCredentialPresence } from './dns-credentials'
import { dnsProviderNameFromNameservers, findMailDnsAnomalies, postmasterHint, resolveDmarcPolicy, resolvePostmasterRecord } from './commands/deploy'
import { dnsCredentialFix, dnsCredentialPresence, dnsProviderLabel } from './dns-credentials'

export interface DoctorCheckResult {
  status: 'pass' | 'warn' | 'fail'
  message: string
}

/** A record as public DNS returns it, in the shape `findMailDnsAnomalies` reads. */
export interface PublicDnsRecord {
  name: string
  type: 'MX' | 'TXT'
  content: string
}

/** The mail domain a deploy provisions: `email.domain`, else the from-address's. */
export function mailDomainFromConfig(cfg: { domain?: unknown, from?: { address?: unknown } } | null | undefined): string | undefined {
  if (typeof cfg?.domain === 'string' && cfg.domain.trim())
    return cfg.domain.trim().toLowerCase()
  const address = cfg?.from?.address
  if (typeof address === 'string' && address.includes('@'))
    return address.split('@')[1]!.trim().toLowerCase() || undefined
  return undefined
}

/**
 * Whether a deploy can write the mail domain's zone.
 *
 * `nameservers` decides the provider, because that is who actually answers
 * for the zone; a declared `infrastructure.dns.provider` that disagrees is
 * reported, since the deploy then only ever tries the declared one.
 */
export function describeMailDnsProvider(input: {
  domain: string
  zone: string
  nameservers: readonly string[]
  declared?: string
  fileKeys: ReadonlySet<string>
  envFile: string
  env?: Record<string, string | undefined>
}): DoctorCheckResult {
  const { domain, zone, nameservers, declared, envFile } = input
  if (nameservers.length === 0)
    return { status: 'warn', message: `Could not resolve the nameservers for ${domain}'s zone, so which provider holds it is unknown (a deploy will try every configured one).` }

  const provider = dnsProviderNameFromNameservers([...nameservers])
  if (!provider) {
    return {
      status: 'warn',
      message: `${zone} is served by ${nameservers.slice(0, 2).join(', ')}, which no deploy can write: ${dnsCredentialFix(null, envFile, nameservers)}`,
    }
  }

  const label = dnsProviderLabel(provider)
  if (declared && declared !== provider) {
    return {
      status: 'warn',
      message: `config/cloud.ts declares '${declared}' as the DNS provider, but ${zone}'s nameservers are ${label}'s. A deploy only tries '${declared}', so ${domain}'s mail records land in a zone nobody resolves. Fix the declaration, or move the zone.`,
    }
  }

  const presence: DnsCredentialPresence = dnsCredentialPresence(provider, input.fileKeys, input.env ?? process.env)
  if (!presence.configured) {
    return {
      status: 'warn',
      message: `${zone} is on ${label}, but ${presence.missing.join(' and ')} ${presence.missing.length === 1 ? 'is' : 'are'} not set in ${envFile} or this environment, so no deploy publishes ${domain}'s mail records. Fix: ${dnsCredentialFix(provider, envFile)}`,
    }
  }

  const where = presence.source === 'file' ? envFile : `this environment (not ${envFile}, so a deploy from elsewhere will not have it)`
  return { status: 'pass', message: `${zone} is on ${label}; credentials found in ${where}` }
}

/** DMARC's `p=` tag, lowercased, or undefined. */
function dmarcPolicy(record: string): string | undefined {
  return record.match(/(?:^|;)\s*p\s*=\s*([a-z]+)/i)?.[1]?.toLowerCase()
}

/**
 * What public DNS says about the records a deploy publishes: each present
 * exactly once, and agreeing with config where that is knowable without the
 * mail server (the DMARC policy, and SPF authorizing the MX host's address).
 *
 * The DKIM selector is the server's choice and only a deploy reads it, so a
 * missing record at the assumed selector is reported as unverified rather
 * than absent.
 */
export function describeMailDnsRecords(input: {
  domain: string
  records: readonly PublicDnsRecord[]
  dkimSelector: string
  dmarcPolicy?: unknown
  /** Addresses the MX host resolves to, for the SPF comparison. */
  mxAddresses?: readonly string[]
}): DoctorCheckResult {
  const { domain, records, dkimSelector } = input
  const dkimFqdn = `${dkimSelector}._domainkey.${domain}`
  const anomalies = findMailDnsAnomalies([...records], [
    { label: 'MX', fqdn: domain, type: 'MX' },
    { label: 'SPF', fqdn: domain, type: 'TXT', owns: content => content.toLowerCase().startsWith('v=spf1') },
    { label: 'DMARC', fqdn: `_dmarc.${domain}`, type: 'TXT', owns: content => content.toLowerCase().startsWith('v=dmarc1') },
  ], domain)

  const dkim = records.filter(record => record.type === 'TXT' && record.name === dkimFqdn)
  const notes: string[] = [...anomalies]
  if (dkim.length === 0)
    notes.push(`DKIM: nothing at ${dkimSelector}._domainkey (the selector the server signs under may differ; a deploy reads the real one)`)
  else if (dkim.length > 1)
    notes.push(`DKIM: ${dkim.length} records at ${dkimFqdn}, expected 1`)

  const dmarc = records.filter(record => record.type === 'TXT' && record.name === `_dmarc.${domain}` && record.content.toLowerCase().startsWith('v=dmarc1'))
  const wanted = resolveDmarcPolicy(input.dmarcPolicy)
  const live = dmarc.length === 1 ? dmarcPolicy(dmarc[0]!.content) : undefined
  if (live && live !== wanted)
    notes.push(`DMARC: live policy is p=${live}, config says p=${wanted}, so the last deploy did not publish it`)

  const spf = records.filter(record => record.type === 'TXT' && record.name === domain && record.content.toLowerCase().startsWith('v=spf1'))
  const addresses = input.mxAddresses ?? []
  if (spf.length === 1 && addresses.length > 0) {
    const mechanisms = spf[0]!.content.toLowerCase().split(/\s+/)
    const delegated = mechanisms.some(term => /^[+~?-]?(?:(?:a|mx)(?:[:/]|$)|include:|redirect=)/.test(term))
    if (!delegated && !addresses.some(address => mechanisms.some(term => term.replace(/^[+~?-]/, '') === `ip4:${address}` || term.replace(/^[+~?-]/, '').startsWith(`ip4:${address}/`))))
      notes.push(`SPF: does not authorize ${addresses.join(', ')}, the address the MX host resolves to`)
  }

  if (notes.length === 0)
    return { status: 'pass', message: `MX, SPF, DKIM (${dkimSelector}) and DMARC each published once for ${domain}` }

  return { status: 'warn', message: `${domain}: ${notes.join('; ')}` }
}

/**
 * Gmail Postmaster Tools: configured and published, configured but not live
 * (no deploy since), or not configured at all (`postmasterHint`'s advice).
 */
export function describePostmaster(domain: string, postmaster: unknown, apexTxt: readonly string[]): DoctorCheckResult {
  const hint = postmasterHint(domain, postmaster)
  if (hint)
    return { status: 'warn', message: hint }
  if (postmaster === false)
    return { status: 'pass', message: 'Not used (email.server.postmaster is false)' }

  const record = resolvePostmasterRecord((postmaster as { google?: unknown }).google)!
  if (!apexTxt.includes(record))
    return { status: 'warn', message: `email.server.postmaster.google is set but ${domain} does not publish it yet; the next deploy that can write the zone will.` }

  return { status: 'pass', message: `Verification record published for ${domain}` }
}

/**
 * One string per TXT record from a `resolveTxt` answer.
 *
 * A record longer than 255 bytes is stored as several character-strings, and
 * Node returns them grouped (`[[a, b]]`). Bun returns every character-string
 * as its own record (`[[a], [b]]`), so a 2048-bit DKIM key read as two
 * records - a duplicate that does not exist. A provider splits at exactly 255
 * bytes, so a lone 255-byte string is joined to the one after it: grouped
 * answers pass through unchanged, and flattened ones are put back together.
 */
export function joinTxtAnswers(answers: readonly (readonly string[])[]): string[] {
  const records: string[] = []
  let continues = false
  for (const chunks of answers) {
    const value = chunks.join('')
    if (continues && records.length > 0)
      records[records.length - 1] += value
    else
      records.push(value)
    continues = chunks.length === 1 && chunks[0]!.length === 255
  }
  return records
}

export interface MailDnsFacts {
  zone: string
  nameservers: string[]
  records: PublicDnsRecord[]
  mxAddresses: string[]
}

/**
 * The public DNS the checks read, fetched in parallel with a short timeout
 * per query so doctor stays fast when a resolver is slow or offline. A lookup
 * that fails reads as "no records", which the checks then report.
 */
export async function gatherMailDnsFacts(domain: string, dkimSelector: string, timeoutMs = 1500): Promise<MailDnsFacts> {
  const { Resolver } = await import('node:dns/promises')
  const { resolveZoneNameservers } = await import('./dns-credentials')
  const resolver = new Resolver({ timeout: timeoutMs, tries: 1 })
  const txt = async (name: string): Promise<PublicDnsRecord[]> =>
    joinTxtAnswers(await resolver.resolveTxt(name).catch(() => [] as string[][])).map(content => ({ name, type: 'TXT' as const, content }))

  const [ns, mx, apex, dmarc, dkim] = await Promise.all([
    resolveZoneNameservers(domain, timeoutMs),
    resolver.resolveMx(domain).catch(() => []),
    txt(domain),
    txt(`_dmarc.${domain}`),
    txt(`${dkimSelector}._domainkey.${domain}`),
  ])

  const exchange = [...mx].sort((a, b) => a.priority - b.priority)[0]?.exchange
  const mxAddresses = exchange ? await resolver.resolve4(exchange).catch(() => [] as string[]) : []

  return {
    zone: ns.zone,
    nameservers: ns.nameservers,
    records: [
      ...mx.map(record => ({ name: domain, type: 'MX' as const, content: record.exchange })),
      ...apex,
      ...dmarc,
      ...dkim,
    ],
    mxAddresses,
  }
}

