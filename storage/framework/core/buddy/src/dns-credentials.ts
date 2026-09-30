/**
 * Which environment variables let a deploy write DNS at each provider, where
 * they were found, and the one command that adds a missing one.
 *
 * Shared by `buddy deploy` (the mail-DNS "publish by hand" path) and
 * `buddy doctor` (the "Mail DNS provider" check), so the fix a deploy prints
 * and the one doctor prints cannot drift apart. A leaf module on purpose: both
 * callers import it, and it imports neither.
 *
 * Nothing here ever returns or prints a value, only whether a key is set.
 */

export type DnsProviderName = 'porkbun' | 'cloudflare' | 'route53' | 'godaddy'

/**
 * The keys each provider needs. Each inner list is one complete way to
 * authenticate; Route 53 accepts static keys or a named profile. Mirrors
 * `dnsProviderConfigsFromEnv` in commands/deploy.ts, which is what actually
 * builds the provider from them.
 */
export const DNS_PROVIDER_ENV_KEYS: Record<DnsProviderName, string[][]> = {
  porkbun: [['PORKBUN_API_KEY', 'PORKBUN_SECRET_KEY']],
  cloudflare: [['CLOUDFLARE_API_TOKEN']],
  godaddy: [['GODADDY_API_KEY', 'GODADDY_API_SECRET']],
  route53: [['AWS_ACCESS_KEY_ID'], ['AWS_PROFILE']],
}

const PROVIDER_LABELS: Record<DnsProviderName, string> = {
  porkbun: 'Porkbun',
  cloudflare: 'Cloudflare',
  godaddy: 'GoDaddy',
  route53: 'Route 53',
}

export function dnsProviderLabel(provider: string): string {
  return PROVIDER_LABELS[provider as DnsProviderName] ?? provider
}

export function isKnownDnsProvider(provider: unknown): provider is DnsProviderName {
  return typeof provider === 'string' && provider in DNS_PROVIDER_ENV_KEYS
}

/** The env file a deploy to `environment` loads: `.env.production` for production. */
export function envFileForEnvironment(environment = 'production'): string {
  return `.env.${environment || 'production'}`
}

/**
 * The keys an env file sets to something non-empty. Values are never kept:
 * an encrypted value counts as set, which is right, since the deploy decrypts
 * it with the environment's key.
 */
export function envFileKeys(content: string): Set<string> {
  const keys = new Set<string>()
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z_][\w.]*)\s*=\s*(.*)$/i)
    if (!match)
      continue
    const value = match[2]!.trim().replace(/^(["'])(.*)\1$/, '$2').trim()
    if (value)
      keys.add(match[1]!)
  }
  return keys
}

export interface DnsCredentialPresence {
  provider: DnsProviderName
  /** True when one complete set of keys is available from either source. */
  configured: boolean
  /** Where the complete set came from, when `configured`. */
  source?: 'file' | 'environment'
  /** The keys of the first alternative that are not set anywhere. */
  missing: string[]
}

/**
 * Whether `provider`'s credentials are available to a deploy, from the env
 * file it loads or from the environment it runs in. The file is preferred as
 * the source to report, since the environment only has them on this machine.
 */
export function dnsCredentialPresence(
  provider: DnsProviderName,
  fileKeys: ReadonlySet<string>,
  env: Record<string, string | undefined> = process.env,
): DnsCredentialPresence {
  const alternatives = DNS_PROVIDER_ENV_KEYS[provider]
  for (const source of ['file', 'environment'] as const) {
    const has = (key: string): boolean => source === 'file' ? fileKeys.has(key) : !!env[key]?.trim()
    if (alternatives.some(keys => keys.every(has)))
      return { provider, configured: true, source, missing: [] }
  }

  const first = alternatives[0]!
  return {
    provider,
    configured: false,
    missing: first.filter(key => !fileKeys.has(key) && !env[key]?.trim()),
  }
}

/**
 * The fix for a zone no configured provider can write, as one line naming
 * the exact command. `provider` is the one the zone's nameservers belong to,
 * or null when they belong to none Stacks can drive.
 */
export function dnsCredentialFix(provider: string | null | undefined, envFile = '.env.production', nameservers: readonly string[] = []): string {
  if (!isKnownDnsProvider(provider)) {
    const where = nameservers.length > 0 ? ` (${nameservers.slice(0, 2).join(', ')})` : ''
    return `the zone's nameservers${where} belong to no DNS provider Stacks can write (Porkbun, Cloudflare, Route 53, GoDaddy), so add the records by hand at that DNS host.`
  }

  const keys = DNS_PROVIDER_ENV_KEYS[provider][0]!
  const commands = keys.map(key => `buddy env:set ${key} <value> -f ${envFile}`).join(' && ')
  return `the zone is on ${dnsProviderLabel(provider)}: ${commands}, then deploy again.`
}

/**
 * The authoritative nameservers for the zone holding `domain`, walking up one
 * label at a time: a mail domain like `mail.example.com` has no NS records of
 * its own, its zone's apex does. Empty when nothing resolves in time.
 */
export async function resolveZoneNameservers(domain: string, timeoutMs = 1500): Promise<{ zone: string, nameservers: string[] }> {
  const { Resolver } = await import('node:dns/promises')
  const resolver = new Resolver({ timeout: timeoutMs, tries: 1 })
  const labels = domain.replace(/\.$/, '').toLowerCase().split('.')

  for (let i = 0; i < labels.length - 1; i++) {
    const zone = labels.slice(i).join('.')
    try {
      const nameservers = await resolver.resolveNs(zone)
      if (nameservers.length > 0)
        return { zone, nameservers }
    }
    catch { /* no NS at this label: try its parent */ }
  }

  return { zone: domain, nameservers: [] }
}
