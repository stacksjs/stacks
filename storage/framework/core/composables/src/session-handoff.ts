/**
 * Moving a server-minted session into the browser (stacksjs/stacks#2236).
 *
 * `@stacksjs/socials` covers the OAuth exchange and `@stacksjs/auth` covers
 * `loginUsingId()` server-side. Nothing bridged the two for a browser, so an
 * app finishing a redirect flow had to hand-serialize a token pack into the
 * framework's own storage keys — from a server action, inside an HTML
 * response:
 *
 *     localStorage.setItem('token', JSON.stringify(JSON.stringify(token)))
 *
 * That double stringify is not a typo: the session persists through
 * `useStorage`, which JSON-stringifies on write, so the string that belongs IN
 * localStorage under `token` is `"abc"` — quotes included. One app got it
 * wrong for `user` and stored the literal `[object Object]`, so every social
 * sign-in produced a broken session. The same inline script also needed
 * hand-written escaping, because a display name containing a closing script
 * tag would terminate the block early.
 *
 * None of that is application logic. This module is the format, owned once.
 *
 * The pack travels in the URL **fragment**, which is never sent to a server:
 * it stays out of access logs, out of `Referer`, and out of any proxy in
 * between — all of which an HTML body carrying the same tokens was exposed to.
 * It does land in browser history, so the client strips it the moment it is
 * read. A single-use code exchanged over POST would keep the tokens out of the
 * URL entirely and is the stronger design; it needs server-side state with a
 * short TTL, which this deliberately does not.
 */

/** The fragment key the handoff travels under. */
export const SESSION_HANDOFF_KEY = 'stx_auth'

export interface SessionHandoffPack {
  /** The access token. `access_token` and `token` are both accepted on read. */
  token: string
  /** The refresh token, when the server minted one. */
  refreshToken?: string
  /** Whatever the app shows as "who is signed in". */
  user?: unknown
  /** Seconds until the access token expires, for callers that track it. */
  expiresIn?: number
}

/**
 * base64url, because the value goes in a URL.
 *
 * Plain base64 uses `+` and `/`, which a fragment tolerates unevenly across
 * clients, and `=` padding that some URL normalisers strip — producing a
 * payload that decodes on one browser and not another.
 */
function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  for (const byte of bytes)
    binary += String.fromCharCode(byte)

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
    + '='.repeat((4 - (input.length % 4)) % 4)

  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++)
    bytes[i] = binary.charCodeAt(i)

  return new TextDecoder().decode(bytes)
}

/** Encode a token pack for the fragment. */
export function encodeSessionHandoff(pack: SessionHandoffPack): string {
  return toBase64Url(JSON.stringify({
    token: pack.token,
    refresh_token: pack.refreshToken,
    user: pack.user,
    expires_in: pack.expiresIn,
  }))
}

/**
 * Decode a fragment payload.
 *
 * Returns null rather than throwing for anything malformed. This runs on a
 * value an attacker can put in a URL, and a thrown error on page load would
 * be a denial of service on the destination page.
 */
export function decodeSessionHandoff(value: string | null | undefined): SessionHandoffPack | null {
  if (!value)
    return null

  try {
    const parsed = JSON.parse(fromBase64Url(value)) as Record<string, unknown>
    const token = parsed.token ?? parsed.access_token
    // A pack with no access token cannot establish a session; treating it as
    // absent is better than half-applying it.
    if (typeof token !== 'string' || token.length === 0)
      return null

    return {
      token,
      refreshToken: typeof parsed.refresh_token === 'string' ? parsed.refresh_token : undefined,
      user: parsed.user,
      expiresIn: typeof parsed.expires_in === 'number' ? parsed.expires_in : undefined,
    }
  }
  catch {
    return null
  }
}

/**
 * Append the handoff to a redirect target.
 *
 * Any fragment already on `redirectTo` is preserved ahead of the handoff, so
 * `/account#billing` still lands on the billing section.
 */
export function buildSessionHandoffUrl(redirectTo: string, pack: SessionHandoffPack): string {
  const encoded = encodeSessionHandoff(pack)
  const [base, existingHash] = splitHash(redirectTo)
  const prefix = existingHash ? `${existingHash}&` : ''
  return `${base}#${prefix}${SESSION_HANDOFF_KEY}=${encoded}`
}

/** Pull the handoff out of a `location.hash`-shaped string. */
export function readSessionHandoff(hash: string | null | undefined): SessionHandoffPack | null {
  if (!hash)
    return null

  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  return decodeSessionHandoff(params.get(SESSION_HANDOFF_KEY))
}

/**
 * The same hash with the handoff removed, ready for `history.replaceState`.
 *
 * Returns '' when nothing else was in it, so the caller can drop the `#`
 * entirely rather than leaving a bare one in the address bar.
 */
export function stripSessionHandoff(hash: string | null | undefined): string {
  if (!hash)
    return ''

  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  params.delete(SESSION_HANDOFF_KEY)
  const rest = params.toString()
  return rest ? `#${rest}` : ''
}

function splitHash(url: string): [string, string] {
  const at = url.indexOf('#')
  return at === -1 ? [url, ''] : [url.slice(0, at), url.slice(at + 1)]
}
