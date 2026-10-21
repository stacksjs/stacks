import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

/**
 * Guarding requests a server makes to URLs somebody else typed in: outgoing
 * webhooks, "import from URL", link previews. Without a guard such a URL is
 * a way into the server's own network (SSRF): `http://169.254.169.254/` is a
 * cloud metadata service, `http://localhost:5432/` the database.
 */

/** Why an outbound URL was refused. */
export type OutboundUrlReason = 'invalid' | 'scheme' | 'credentials' | 'private' | 'unresolvable' | 'redirects' | 'too-large' | 'unreplayable-body'

/** Thrown by {@link assertPublicOutboundUrl}. */
export class OutboundUrlError extends Error {
  readonly reason: OutboundUrlReason

  constructor(message: string, reason: OutboundUrlReason) {
    super(message)
    this.name = 'OutboundUrlError'
    this.reason = reason
  }
}

export interface OutboundUrlOptions {
  /** Accept `http:` as well as `https:`. Default false. */
  allowHttp?: boolean
  /**
   * Accept loopback, private, link-local and other non-public addresses.
   * Default false. For local development and tests only.
   */
  allowPrivate?: boolean
  /** Resolve a host name to its addresses. Defaults to the system resolver; tests pass their own. */
  resolve?: (hostname: string) => Promise<string[]>
}

function ipv4Parts(address: string): number[] | null {
  const parts = address.split('.')
  if (parts.length !== 4)
    return null
  const numbers = parts.map(part => (/^\d{1,3}$/.test(part) ? Number(part) : Number.NaN))
  return numbers.every(n => Number.isInteger(n) && n >= 0 && n <= 255) ? numbers : null
}

function privateIpv4(address: string): boolean {
  const p = ipv4Parts(address)
  if (!p)
    return true
  const [a, b, c] = p as [number, number, number, number]
  return a === 0 // "this" network
    || a === 10
    || (a === 100 && b >= 64 && b <= 127) // carrier-grade NAT
    || a === 127
    || (a === 169 && b === 254) // link-local, cloud metadata
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0 && (c === 0 || c === 2)) // IETF protocol assignments, TEST-NET-1
    || (a === 192 && b === 88 && c === 99) // 6to4 relay anycast
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19)) // benchmarking
    || (a === 198 && b === 51 && c === 100) // TEST-NET-2
    || (a === 203 && b === 0 && c === 113) // TEST-NET-3
    || a >= 224 // multicast, reserved, broadcast
}

/** Expand an IPv6 address to its eight 16-bit groups, or null when it is not one. */
function ipv6Groups(address: string): number[] | null {
  let text = address.toLowerCase()
  const zone = text.indexOf('%')
  if (zone !== -1)
    text = text.slice(0, zone)
  // A trailing dotted IPv4 (::ffff:10.0.0.1) becomes two groups.
  const dotted = text.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/)
  if (dotted) {
    const v4 = ipv4Parts(dotted[2]!)
    if (!v4)
      return null
    text = `${dotted[1]}${((v4[0]! << 8) | v4[1]!).toString(16)}:${((v4[2]! << 8) | v4[3]!).toString(16)}`
  }
  const halves = text.split('::')
  if (halves.length > 2)
    return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const missing = 8 - head.length - tail.length
  if ((halves.length === 1 && missing !== 0) || missing < 0)
    return null
  const groups = [...head, ...Array.from({ length: halves.length === 2 ? missing : 0 }, () => '0'), ...tail]
  if (groups.length !== 8 || groups.some(group => !/^[0-9a-f]{1,4}$/.test(group)))
    return null
  return groups.map(group => Number.parseInt(group, 16))
}

function privateIpv6(address: string): boolean {
  const g = ipv6Groups(address)
  if (!g)
    return true
  const embeddedV4 = `${g[6]! >> 8}.${g[6]! & 255}.${g[7]! >> 8}.${g[7]! & 255}`
  if (g.slice(0, 7).every(n => n === 0))
    return true // :: and ::1 (and the deprecated IPv4-compatible range)
  if (g.slice(0, 5).every(n => n === 0) && g[5] === 0xFFFF)
    return privateIpv4(embeddedV4) // IPv4-mapped
  if (g[0] === 0x64 && g[1] === 0xFF9B && g.slice(2, 6).every(n => n === 0))
    return privateIpv4(embeddedV4) // NAT64
  if (g[0] === 0x2002)
    return privateIpv4(`${g[1]! >> 8}.${g[1]! & 255}.${g[2]! >> 8}.${g[2]! & 255}`) // 6to4
  return (g[0]! & 0xFE00) === 0xFC00 // unique local fc00::/7
    || (g[0]! & 0xFFC0) === 0xFE80 // link-local fe80::/10
    || (g[0]! & 0xFF00) === 0xFF00 // multicast
    || (g[0] === 0x2001 && g[1] === 0x0DB8) // documentation
    || (g[0] === 0x2001 && g[1]! < 0x0200) // Teredo and other IETF assignments
    || g[0] === 0x0100 // discard-only
}

/**
 * Whether an IP address is anything other than a public unicast address:
 * loopback, private, carrier-grade NAT, link-local (cloud metadata),
 * documentation, multicast, reserved, or IPv4 hidden in an IPv6 form. A
 * string that is not an IP address counts as private, so a caller that forgot
 * to resolve a name fails closed.
 */
export function isPrivateAddress(address: string): boolean {
  const text = address.replace(/^\[|\]$/g, '')
  const family = isIP(text.split('%')[0]!)
  if (family === 4)
    return privateIpv4(text)
  if (family === 6)
    return privateIpv6(text)
  return true
}

const LOCAL_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain', '.home.arpa']

/**
 * What is wrong with an outbound URL before any lookup: not a URL, a scheme
 * other than https (and http when allowed), a username or password in it, or
 * a host that is a private address or a local-only name. Null when nothing is.
 * Pair it with {@link assertPublicOutboundUrl} at send time, since a public
 * name can still resolve to a private address.
 */
export function outboundUrlProblem(url: string, options: OutboundUrlOptions = {}): { reason: OutboundUrlReason, message: string } | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  }
  catch {
    return { reason: 'invalid', message: 'Not a valid URL' }
  }
  const schemes = options.allowHttp ? ['https:', 'http:'] : ['https:']
  if (!schemes.includes(parsed.protocol))
    return { reason: 'scheme', message: options.allowHttp ? 'The URL must start with https:// or http://' : 'The URL must start with https://' }
  if (parsed.username || parsed.password)
    return { reason: 'credentials', message: 'The URL must not contain a username or password' }
  if (options.allowPrivate)
    return null
  const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '')
  if (!host)
    return { reason: 'invalid', message: 'Not a valid URL' }
  if (isIP(host.split('%')[0]!)) {
    return isPrivateAddress(host) ? { reason: 'private', message: 'The URL points at a private or local address' } : null
  }
  if (host === 'localhost' || !host.includes('.') || LOCAL_SUFFIXES.some(suffix => host.endsWith(suffix)))
    return { reason: 'private', message: 'The URL points at a private or local address' }
  return null
}

async function systemResolve(hostname: string): Promise<string[]> {
  const records = await lookup(hostname, { all: true, verbatim: true })
  return records.map(record => record.address)
}

/**
 * Check an outbound URL right before the request: {@link outboundUrlProblem},
 * then every address its host resolves to must be public. Throws
 * {@link OutboundUrlError}; returns the parsed URL.
 *
 * **Blessing a URL is not the same as making a safe request, and this only
 * does the first.** A caller that takes the returned URL and fetches it gives
 * the guarantee straight back (stacksjs/stacks#2909):
 *
 * - `fetch` defaults to `redirect: 'follow'`, so a validated public host that
 *   answers `302 Location: http://169.254.169.254/...` is followed, and
 *   nothing checks the second request. Pass `redirect: 'manual'` and
 *   re-validate every hop, or the whole guard is one redirect wide.
 * - `fetch` resolves the name again, so an address checked here is not the
 *   address connected to. A host answering public once and private a moment
 *   later (DNS rebinding) passes.
 *
 * Prefer {@link fetchPublicUrl}, which makes the request itself and handles
 * both. Use this one when the check alone is what you want - validating a
 * webhook URL at the moment someone saves it, say.
 */
export async function assertPublicOutboundUrl(url: string, options: OutboundUrlOptions = {}): Promise<URL> {
  return (await validatedTarget(url, options)).parsed
}

/** Validate and retain exactly the DNS answer used for the connection. */
async function validatedTarget(url: string, options: OutboundUrlOptions): Promise<{ parsed: URL, addresses: string[] }> {
  const problem = outboundUrlProblem(url, options)
  if (problem)
    throw new OutboundUrlError(problem.message, problem.reason)
  const parsed = new URL(url)
  const host = parsed.hostname.replace(/^\[|\]$/g, '')
  if (options.allowPrivate || isIP(host.split('%')[0]!))
    return { parsed, addresses: [] }

  let addresses: string[]
  try {
    addresses = await (options.resolve ?? systemResolve)(host)
  }
  catch {
    throw new OutboundUrlError(`Could not resolve ${host}`, 'unresolvable')
  }
  if (!addresses.length)
    throw new OutboundUrlError(`Could not resolve ${host}`, 'unresolvable')
  if (addresses.some(isPrivateAddress))
    throw new OutboundUrlError('The URL points at a private or local address', 'private')
  return { parsed, addresses }
}

export interface PublicFetchOptions extends OutboundUrlOptions {
  /** Redirect hops to follow, each re-validated. Default 3; 0 refuses any. */
  maxRedirects?: number
  /** Abort the whole chain after this long. Default 10s. */
  timeoutMs?: number
  /** Refuse a response body larger than this. Default 5 MiB. */
  maxBytes?: number
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

/** Headers that must not follow a redirect to a different origin. */
const CROSS_ORIGIN_SENSITIVE = ['authorization', 'cookie', 'proxy-authorization']

/**
 * Send the request to the address that was checked, not to the name.
 *
 * The URL's host is swapped for a resolved address and the original name is
 * put back in `Host` (and in TLS SNI, so the certificate is still validated
 * against the name rather than the address). Without this, the guard checks
 * one answer and the connection uses another.
 */
function pinnedRequest(parsed: URL, address: string | undefined, init: RequestInit): [string, RequestInit] {
  if (!address)
    return [parsed.href, init]

  const pinned = new URL(parsed.href)
  pinned.hostname = isIP(address) === 6 ? `[${address}]` : address

  const headers = new Headers(init.headers)
  headers.set('Host', parsed.host)

  const withSni: RequestInit & { tls?: { serverName: string } } = { ...init, headers }
  if (parsed.protocol === 'https:')
    withSni.tls = { serverName: parsed.hostname.replace(/^\[|\]$/g, '') }

  return [pinned.href, withSni]
}

/** Read at most `maxBytes`, refusing rather than truncating past it. */
async function readCapped(response: Response, maxBytes: number): Promise<Response> {
  const declared = Number(response.headers.get('content-length') ?? Number.NaN)
  if (Number.isFinite(declared) && declared > maxBytes)
    throw new OutboundUrlError(`The response is ${declared} bytes, over the ${maxBytes} byte limit`, 'too-large')

  if (!response.body)
    return response

  const chunks: Uint8Array[] = []
  let total = 0
  const reader = response.body.getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done)
        break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel()
        throw new OutboundUrlError(`The response is over the ${maxBytes} byte limit`, 'too-large')
      }
      chunks.push(value)
    }
  }
  finally {
    reader.releaseLock()
  }

  const body = new Uint8Array(total)
  let at = 0
  for (const chunk of chunks) {
    body.set(chunk, at)
    at += chunk.byteLength
  }

  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers })
}

/**
 * Fetch a URL somebody else supplied, checking every hop rather than the
 * first one (stacksjs/stacks#2909).
 *
 * {@link assertPublicOutboundUrl} blesses a URL, and the caller's `fetch`
 * then follows redirects and re-resolves the name, which hands back
 * everything the check established. This makes the request itself:
 *
 * - every hop is validated by the same rules, up to `maxRedirects`
 * - the connection goes to an address that was checked, with the name in
 *   `Host` and in TLS SNI, so a rebinding answer cannot be substituted
 * - `Authorization`, `Cookie` and `Proxy-Authorization` are dropped when a
 *   redirect crosses to another origin
 * - the body is capped and the whole chain is bounded by a timeout
 *
 * A streaming request body cannot be replayed onto a redirect, so a redirect
 * is refused rather than silently sent without it.
 */
export async function fetchPublicUrl(url: string, init: RequestInit = {}, options: PublicFetchOptions = {}): Promise<Response> {
  const maxRedirects = options.maxRedirects ?? 3
  const maxBytes = options.maxBytes ?? 5 * 1024 * 1024
  const timeoutMs = options.timeoutMs ?? 10_000

  const deadline = AbortSignal.timeout(timeoutMs)
  const signal = init.signal ? AbortSignal.any([init.signal, deadline]) : deadline

  const replayable = init.body == null || typeof init.body === 'string' || init.body instanceof Uint8Array || init.body instanceof ArrayBuffer
  let current = url
  let request: RequestInit = { ...init, signal, redirect: 'manual' }
  let origin = ''

  for (let hop = 0; ; hop++) {
    const { parsed, addresses } = await validatedTarget(current, options)

    if (origin && parsed.origin !== origin) {
      const headers = new Headers(request.headers)
      for (const name of CROSS_ORIGIN_SENSITIVE)
        headers.delete(name)
      request = { ...request, headers }
    }
    origin = parsed.origin

    const [target, pinned] = pinnedRequest(parsed, addresses[0], request)
    const response = await fetch(target, pinned)

    if (!REDIRECT_STATUSES.has(response.status))
      return await readCapped(response, maxBytes)

    const location = response.headers.get('location')
    if (!location)
      return await readCapped(response, maxBytes)

    if (hop >= maxRedirects)
      throw new OutboundUrlError(`The URL redirected more than ${maxRedirects} times`, 'redirects')

    if (!replayable)
      throw new OutboundUrlError('The URL redirected, and a streaming request body cannot be sent again', 'unreplayable-body')

    // 303 always becomes GET; 301 and 302 do for anything that is not already
    // GET or HEAD, which is what every client does in practice. 307 and 308
    // keep the method and the body, which is the point of them existing.
    const method = (request.method ?? 'GET').toUpperCase()
    if (response.status === 303 || ((response.status === 301 || response.status === 302) && method !== 'GET' && method !== 'HEAD'))
      request = { ...request, method: 'GET', body: undefined }

    current = new URL(location, parsed).href
  }
}
