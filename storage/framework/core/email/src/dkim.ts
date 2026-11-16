/**
 * DKIM signing (RFC 6376): rsa-sha256, relaxed/relaxed.
 *
 * A message is signed so a receiver can tell that the domain in `d=` stands
 * behind it. That matters for mail sent on a domain's behalf through someone
 * else's server: SPF is checked against the envelope sender, which belongs to
 * whoever relays the mail, so the only thing that can align with the visible
 * From domain is a signature made with that domain's own key. DMARC passes on
 * either, and this is the one a relay can give its customers.
 *
 * Signing here, before the message is handed to a mail server, means the
 * server only has to carry it. No server needs to hold a key for every domain
 * that sends through it, and adding a domain is publishing one TXT record.
 *
 * Nothing in this file reads configuration or touches the network.
 */

import { Buffer } from 'node:buffer'
import { createHash, createPublicKey, createSign, createVerify, generateKeyPairSync } from 'node:crypto'

export interface DkimSigningOptions {
  /** The signing domain, `d=`. For DMARC it must be the From domain or a parent of it. */
  domain: string
  /** The selector, `s=`: the key is published at `<selector>._domainkey.<domain>`. */
  selector: string
  /** The private key, PEM (PKCS#8 or PKCS#1). */
  privateKey: string
  /**
   * Header fields to sign, in order. The defaults cover what a receiver shows
   * and what a replay would want to change. From is always signed.
   */
  headers?: readonly string[]
}

/** Signed when present. `from` is signed even when a caller's list leaves it out. */
export const DEFAULT_SIGNED_HEADERS: readonly string[] = [
  'from',
  'to',
  'cc',
  'subject',
  'date',
  'message-id',
  'reply-to',
  'mime-version',
  'content-type',
  'content-transfer-encoding',
  'list-unsubscribe',
  'list-unsubscribe-post',
]

interface ParsedMessage {
  /** Header fields in the order they appear: lower-cased name, and the raw field with its folding. */
  headers: Array<{ name: string, raw: string }>
  body: string
}

/** Split a raw message into its header fields and its body. Line endings are normalised to CRLF. */
function parse(raw: string): ParsedMessage {
  const text = raw.replace(/\r?\n/g, '\r\n')
  const split = text.indexOf('\r\n\r\n')
  const head = split === -1 ? text : text.slice(0, split)
  const body = split === -1 ? '' : text.slice(split + 4)

  const headers: ParsedMessage['headers'] = []
  for (const line of head.split('\r\n')) {
    // A line that starts with white space continues the field before it.
    if (/^[ \t]/.test(line) && headers.length > 0) {
      headers[headers.length - 1]!.raw += `\r\n${line}`
      continue
    }
    const colon = line.indexOf(':')
    if (colon < 1)
      continue
    headers.push({ name: line.slice(0, colon).trim().toLowerCase(), raw: line })
  }
  return { headers, body }
}

/** Relaxed header canonicalisation (RFC 6376 3.4.2): one field, without its trailing CRLF. */
function canonicalHeader(raw: string): string {
  const colon = raw.indexOf(':')
  const name = raw.slice(0, colon).trim().toLowerCase()
  const value = raw.slice(colon + 1).replace(/\r\n/g, '').replace(/[ \t]+/g, ' ').trim()
  return `${name}:${value}`
}

/** Relaxed body canonicalisation (RFC 6376 3.4.4). An empty body is a single CRLF. */
function canonicalBody(body: string): string {
  const lines = body.split('\r\n').map(line => line.replace(/[ \t]+/g, ' ').replace(/ +$/, ''))
  while (lines.length > 0 && lines[lines.length - 1] === '')
    lines.pop()
  return lines.length === 0 ? '\r\n' : `${lines.join('\r\n')}\r\n`
}

function bodyHash(body: string): string {
  return createHash('sha256').update(canonicalBody(body)).digest('base64')
}

/**
 * The header fields a signature covers, as the receiver will pick them: for
 * each name in `h=`, the last unused field of that name, counting from the
 * bottom of the header block (RFC 6376 5.4.2).
 */
function pick(headers: ParsedMessage['headers'], names: readonly string[]): string[] {
  const used = new Set<number>()
  const picked: string[] = []
  for (const name of names) {
    for (let i = headers.length - 1; i >= 0; i--) {
      if (used.has(i) || headers[i]!.name !== name)
        continue
      used.add(i)
      picked.push(canonicalHeader(headers[i]!.raw))
      break
    }
  }
  return picked
}

function cleanDomain(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, '')
}

/**
 * Sign a raw message, answering it with a `DKIM-Signature` field in front.
 *
 * The message is otherwise returned as it was given, byte for byte after its
 * line endings are made CRLF: a signature is over what is sent, so anything
 * that rewrites the message afterwards breaks it.
 */
export function signDkim(raw: string, options: DkimSigningOptions): string {
  const domain = cleanDomain(options.domain)
  const selector = options.selector.trim().toLowerCase()
  if (!/^[a-z0-9.-]+$/.test(domain) || !/^[a-z0-9._-]+$/.test(selector))
    throw new Error('[dkim] The signing domain and selector must be plain DNS names.')

  const message = parse(raw)
  const present = new Set(message.headers.map(header => header.name))
  const wanted = [...new Set(['from', ...(options.headers ?? DEFAULT_SIGNED_HEADERS).map(name => name.toLowerCase())])]
  const names = wanted.filter(name => present.has(name))
  if (!present.has('from'))
    throw new Error('[dkim] A message with no From field cannot be signed.')

  const unsigned = [
    'v=1',
    'a=rsa-sha256',
    'c=relaxed/relaxed',
    `d=${domain}`,
    `s=${selector}`,
    `t=${Math.floor(Date.now() / 1000)}`,
    `h=${names.join(':')}`,
    `bh=${bodyHash(message.body)}`,
    'b=',
  ].join('; ')

  // The signature covers the chosen fields, each with its CRLF, then its own
  // field with an empty `b=` and no trailing CRLF.
  const signed = `${pick(message.headers, names).map(header => `${header}\r\n`).join('')}${canonicalHeader(`DKIM-Signature: ${unsigned}`)}`
  const signature = createSign('RSA-SHA256').update(signed).sign(options.privateKey, 'base64')

  // Folded so no line runs past what a mail server will accept.
  const folded = signature.match(/.{1,72}/g)?.join('\r\n ') ?? signature
  const normalised = raw.replace(/\r?\n/g, '\r\n')
  return `DKIM-Signature: ${unsigned}${folded}\r\n${normalised}`
}

export interface DkimVerification {
  ok: boolean
  /** Why it did not verify. */
  reason?: string
  domain?: string
  selector?: string
}

/**
 * Check a message's first DKIM signature against a public key.
 *
 * For tests and for a service checking its own signing before it trusts it
 * with real mail. A receiver looks the key up in DNS; this is given it.
 */
export function verifyDkim(raw: string, publicKey: string): DkimVerification {
  const message = parse(raw)
  const field = message.headers.find(header => header.name === 'dkim-signature')
  if (!field)
    return { ok: false, reason: 'no signature' }

  const value = field.raw.slice(field.raw.indexOf(':') + 1).replace(/\r\n/g, '')
  const tags = new Map<string, string>()
  for (const part of value.split(';')) {
    const eq = part.indexOf('=')
    if (eq > 0)
      tags.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim())
  }

  const domain = tags.get('d')
  const selector = tags.get('s')
  const signature = (tags.get('b') ?? '').replace(/\s+/g, '')
  if (tags.get('bh') !== bodyHash(message.body))
    return { ok: false, reason: 'the body was changed', domain, selector }

  const names = (tags.get('h') ?? '').split(':').map(name => name.trim().toLowerCase()).filter(Boolean)
  const others = message.headers.filter(header => header !== field)
  // The signature field itself, with the value of `b=` taken out.
  const emptied = field.raw.replace(/([;\s]b=)[^;]*/, '$1')
  const signed = `${pick(others, names).map(header => `${header}\r\n`).join('')}${canonicalHeader(emptied)}`

  const ok = createVerify('RSA-SHA256').update(signed).verify(publicKey, signature, 'base64')
  return ok ? { ok, domain, selector } : { ok, reason: 'the signature does not match', domain, selector }
}

export interface DkimKeyPair {
  /** PEM, PKCS#8. Keep it secret. */
  privateKey: string
  /** PEM, SPKI. */
  publicKey: string
  /** The value to publish as TXT at `<selector>._domainkey.<domain>`. */
  record: string
}

/** The TXT value that publishes a public key: `v=DKIM1; k=rsa; p=…`. */
export function dkimRecord(publicKey: string): string {
  const der = createPublicKey(publicKey).export({ type: 'spki', format: 'der' })
  return `v=DKIM1; k=rsa; p=${Buffer.from(der).toString('base64')}`
}

/** A new 2048-bit RSA key pair for a signing domain. */
export function generateDkimKeyPair(): DkimKeyPair {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  })
  return { privateKey, publicKey, record: dkimRecord(publicKey) }
}

/** Where a domain's key is published. */
export function dkimRecordName(domain: string, selector: string): string {
  return `${selector.trim().toLowerCase()}._domainkey.${cleanDomain(domain)}`
}

/** A TXT answer's `p=` value, with the white space DNS splits it by removed. */
export function dkimRecordKey(record: string): string {
  return (/(?:^|;)\s*p=([^;]*)/.exec(record.replace(/"\s*"/g, '').replace(/"/g, ''))?.[1] ?? '').replace(/\s+/g, '')
}
