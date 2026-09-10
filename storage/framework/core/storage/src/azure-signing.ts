/**
 * Azure Blob Storage request signing (stacksjs/stacks#1896).
 *
 * Azure is the one storage provider in that issue with no S3-compatible API.
 * R2, GCS, Filebase, Backblaze, Hetzner and MinIO all reuse the `s3` adapter
 * behind a different endpoint; Azure has its own REST surface, its own
 * authorization scheme, and its own signed-URL format, so it needs a real
 * implementation.
 *
 * Written here rather than taken from `@azure/storage-blob`, for the same
 * reason `gcsDisk` declined the official Google SDK: that package pulls a large
 * dependency tree and an auth-flow surface of its own, to do work that is a few
 * dozen lines of HMAC. `s3-presigned-post.ts` next door made the same call for
 * SigV4 POST policies.
 *
 * Everything in this file is a pure function of its inputs. That is deliberate:
 * signing is the part that is impossible to debug from a failed request (Azure
 * answers a mis-signed request with `AuthenticationFailed` and the string it
 * expected, which is only useful if you can produce yours next to it), so it is
 * separated from the adapter and tested directly.
 *
 * Specs:
 * - Shared Key: https://learn.microsoft.com/rest/api/storageservices/authorize-with-shared-key
 * - Service SAS: https://learn.microsoft.com/rest/api/storageservices/create-service-sas
 */

import { Buffer } from 'node:buffer'
import { createHmac } from 'node:crypto'

/**
 * The service SAS version this module signs for.
 *
 * The string-to-sign gained fields over time, so the version is not cosmetic -
 * signing 2020-12-06's field list and declaring an older `sv` produces a
 * signature Azure computes differently and rejects. 2020-12-06 is the first
 * version carrying `signedEncryptionScope`, and is accepted by every currently
 * supported storage account.
 */
export const SAS_VERSION = '2020-12-06'

/** The REST API version sent on Shared Key requests. */
export const REST_VERSION = '2021-08-06'

/** Credentials for Shared Key authorization: the account and one of its keys. */
export interface AzureSharedKeyCredential {
  /** Storage account name, e.g. `mystorageaccount`. */
  account: string
  /** Account key, base64 as Azure presents it in the portal. */
  accountKey: string
}

/** A request to authorize, reduced to what the string-to-sign reads. */
export interface AzureRequestToSign {
  /** HTTP method, uppercase. */
  method: string
  /**
   * The request URL. Its path supplies the canonicalized resource and its
   * query string the canonicalized query parameters, so it must be the exact
   * URL that will be sent - a parameter added afterwards invalidates the
   * signature.
   */
  url: string | URL
  /** Request headers. Names are matched case-insensitively. */
  headers: Record<string, string | undefined>
}

function hmacBase64(keyBase64: string, data: string): string {
  return createHmac('sha256', Buffer.from(keyBase64, 'base64')).update(data, 'utf8').digest('base64')
}

/** Case-insensitive header lookup, returning `''` for anything absent. */
function header(headers: Record<string, string | undefined>, name: string): string {
  const wanted = name.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted)
      return value ?? ''
  }
  return ''
}

/**
 * The `x-ms-*` headers, folded into the form the string-to-sign expects:
 * lowercased names, sorted lexicographically, whitespace collapsed out of the
 * values, one `name:value` per line.
 *
 * Sorting is by the header name only, and by ordinal comparison rather than
 * locale - `localeCompare` orders `x-ms-blob-type` against `x-ms-date`
 * differently under some locales, which is a signature that works on one
 * machine and fails on another.
 */
export function canonicalizedHeaders(headers: Record<string, string | undefined>): string {
  const entries = Object.entries(headers)
    .filter(([name, value]) => name.toLowerCase().startsWith('x-ms-') && value !== undefined && value !== '')
    .map(([name, value]) => [name.toLowerCase(), String(value).replace(/\s+/g, ' ').trim()] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))

  return entries.map(([name, value]) => `${name}:${value}\n`).join('')
}

/**
 * The canonicalized resource: the account-scoped path, then every query
 * parameter, lowercased and sorted, one per line.
 *
 * Repeated parameters are joined with commas after sorting their values, which
 * is what the specification calls for and what makes `?include=metadata&include=snapshots`
 * sign the same way whatever order the caller built it in.
 */
export function canonicalizedResource(account: string, url: string | URL): string {
  const parsed = typeof url === 'string' ? new URL(url) : url

  const grouped = new Map<string, string[]>()
  for (const [name, value] of parsed.searchParams) {
    const key = name.toLowerCase()
    const existing = grouped.get(key)
    if (existing)
      existing.push(value)
    else
      grouped.set(key, [value])
  }

  const lines = [...grouped.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([name, values]) => `${name}:${values.slice().sort().join(',')}`)

  return [`/${account}${parsed.pathname}`, ...lines].join('\n')
}

/**
 * The Shared Key string-to-sign.
 *
 * The blank lines are load bearing: the format is positional, with one line per
 * header whether or not the request carries it, so a dropped empty line shifts
 * every field after it. `Content-Length` is the one exception to "send what you
 * have" - it is sent as an empty string when zero, because a literal `0` was
 * what versions before 2015-02-21 signed and Azure has read it as empty ever
 * since.
 */
export function sharedKeyStringToSign(account: string, request: AzureRequestToSign): string {
  const { headers } = request
  const contentLength = header(headers, 'content-length')

  return [
    request.method.toUpperCase(),
    header(headers, 'content-encoding'),
    header(headers, 'content-language'),
    contentLength === '0' ? '' : contentLength,
    header(headers, 'content-md5'),
    header(headers, 'content-type'),
    // Empty because every request this module signs carries `x-ms-date`, which
    // takes precedence over `Date` and is already in the canonicalized headers.
    header(headers, 'date'),
    header(headers, 'if-modified-since'),
    header(headers, 'if-match'),
    header(headers, 'if-none-match'),
    header(headers, 'if-unmodified-since'),
    header(headers, 'range'),
  ].join('\n')
    + `\n${canonicalizedHeaders(headers)}${canonicalizedResource(account, request.url)}`
}

/**
 * The `Authorization` header value for a Shared Key request.
 *
 * @example
 * ```ts
 * headers.Authorization = sharedKeyAuthorization(
 *   { account: 'acct', accountKey },
 *   { method: 'PUT', url, headers },
 * )
 * ```
 */
export function sharedKeyAuthorization(credential: AzureSharedKeyCredential, request: AzureRequestToSign): string {
  const signature = hmacBase64(credential.accountKey, sharedKeyStringToSign(credential.account, request))
  return `SharedKey ${credential.account}:${signature}`
}

/** What a service SAS grants, and for how long. */
export interface ServiceSasOptions {
  /** Container the blob lives in. */
  container: string
  /**
   * Blob name within the container. Omit to sign the container itself, which
   * is what a listing URL needs.
   */
  blob?: string
  /**
   * Permission letters, in Azure's required order: `racwdxltmeop`. `r` is read,
   * `w` write, `d` delete, `c` create, `l` list. Out-of-order letters are
   * accepted by the signature and rejected by the service, so
   * {@link orderSasPermissions} exists to put them right.
   */
  permissions: string
  /** When the SAS becomes valid. Omit to make it valid immediately. */
  startsAt?: Date
  /** When the SAS expires. */
  expiresAt: Date
  /** Restrict to HTTPS (the default) or allow both. */
  protocol?: 'https' | 'https,http'
  /** A single IP or an inclusive `start-end` range the SAS is usable from. */
  ip?: string
  /** `Content-Disposition` the service returns with the blob, for download URLs. */
  contentDisposition?: string
  /** `Content-Type` the service returns with the blob, overriding what was stored. */
  contentType?: string
}

/** Azure's required permission order. Any other order is rejected by the service. */
const SAS_PERMISSION_ORDER = 'racwdxltmeop'

/**
 * Sort permission letters into the order Azure requires, dropping duplicates
 * and anything unrecognised.
 *
 * The service compares the permission string against a fixed order rather than
 * as a set, so `wr` is not `rw`; it answers `AuthorizationPermissionMismatch`,
 * which reads like the SAS lacks the permission it plainly names.
 */
export function orderSasPermissions(permissions: string): string {
  const wanted = new Set(permissions.toLowerCase())
  return [...SAS_PERMISSION_ORDER].filter(letter => wanted.has(letter)).join('')
}

/** Azure's SAS timestamp format: UTC, second precision, no milliseconds. */
export function sasTimestamp(date: Date): string {
  return `${date.toISOString().slice(0, 19)}Z`
}

/**
 * Build and sign a service SAS, returning it as a query string.
 *
 * The field list is positional and version-specific; see {@link SAS_VERSION}.
 * Fields this module does not offer (`signedIdentifier`, `signedSnapshotTime`,
 * `signedEncryptionScope`) are still signed, as empty lines, because their
 * absence is part of what the service recomputes.
 *
 * @example
 * ```ts
 * const query = serviceSasQuery(
 *   { account: 'acct', accountKey },
 *   { container: 'uploads', blob: 'reports/q1.pdf', permissions: 'r', expiresAt },
 * )
 * const url = `https://acct.blob.core.windows.net/uploads/reports/q1.pdf?${query}`
 * ```
 */
export function serviceSasQuery(credential: AzureSharedKeyCredential, options: ServiceSasOptions): string {
  const permissions = orderSasPermissions(options.permissions)
  const start = options.startsAt ? sasTimestamp(options.startsAt) : ''
  const expiry = sasTimestamp(options.expiresAt)
  const protocol = options.protocol ?? 'https'
  const resource = options.blob ? 'b' : 'c'
  const ip = options.ip ?? ''

  const path = options.blob
    ? `/blob/${credential.account}/${options.container}/${options.blob}`
    : `/blob/${credential.account}/${options.container}`

  const stringToSign = [
    permissions,
    start,
    expiry,
    path,
    '', // signedIdentifier - stored access policies are not modelled here
    ip,
    protocol,
    SAS_VERSION,
    resource,
    '', // signedSnapshotTime
    '', // signedEncryptionScope
    '', // rscc: Cache-Control
    options.contentDisposition ?? '', // rscd
    '', // rsce: Content-Encoding
    '', // rscl: Content-Language
    options.contentType ?? '', // rsct
  ].join('\n')

  const signature = hmacBase64(credential.accountKey, stringToSign)

  const query = new URLSearchParams()
  query.set('sv', SAS_VERSION)
  query.set('sr', resource)
  query.set('sp', permissions)
  if (start)
    query.set('st', start)
  query.set('se', expiry)
  query.set('spr', protocol)
  if (ip)
    query.set('sip', ip)
  if (options.contentDisposition)
    query.set('rscd', options.contentDisposition)
  if (options.contentType)
    query.set('rsct', options.contentType)
  query.set('sig', signature)

  return query.toString()
}
