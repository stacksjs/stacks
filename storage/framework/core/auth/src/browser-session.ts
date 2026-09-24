import type { AuthOptions } from '@stacksjs/types'
import { config } from '@stacksjs/config'
import { authCookie } from './cookie'

export interface ResolvedBrowserSessionPolicy {
  remembered: boolean
  /** Absolute access-token lifetime in milliseconds. */
  lifetimeMs: number
  /** Value accepted by `Auth.createTokenForUser()`. */
  expiresInMinutes: number
  withRefreshToken: boolean
}

type BrowserSessionPolicyConfig = Pick<Partial<AuthOptions>, 'tokenExpiry' | 'browserSession'>

const REMEMBERED_INPUTS = new Set(['1', 'true', 'on', 'yes'])

/** Normalize the common HTML, JSON, and form encodings of a remember choice. */
export function browserSessionRemembered(value: unknown): boolean {
  if (value === true || value === 1)
    return true
  if (typeof value !== 'string')
    return false
  return REMEMBERED_INPUTS.has(value.trim().toLowerCase())
}

function validLifetime(value: unknown, setting: string): number {
  const milliseconds = Number(value)
  if (!Number.isFinite(milliseconds) || milliseconds <= 0)
    throw new TypeError(`[auth] config.auth.${setting} must be a positive lifetime in milliseconds.`)
  return milliseconds
}

/**
 * Resolve browser-only issuance policy without changing API/OAuth defaults.
 */
export function resolveBrowserSessionPolicy(
  remember: unknown,
  auth: BrowserSessionPolicyConfig = config.auth,
): ResolvedBrowserSessionPolicy {
  const baselineLifetime = validLifetime(
    auth.browserSession?.baselineLifetime ?? auth.tokenExpiry ?? 60 * 60 * 1000,
    auth.browserSession?.baselineLifetime === undefined ? 'tokenExpiry' : 'browserSession.baselineLifetime',
  )
  const rememberedLifetime = validLifetime(
    auth.browserSession?.rememberedLifetime ?? baselineLifetime,
    'browserSession.rememberedLifetime',
  )
  const withRefreshToken = auth.browserSession?.withRefreshToken ?? true
  if (typeof withRefreshToken !== 'boolean')
    throw new TypeError('[auth] config.auth.browserSession.withRefreshToken must be a boolean.')

  const remembered = browserSessionRemembered(remember)
  const lifetimeMs = remembered ? rememberedLifetime : baselineLifetime

  return {
    remembered,
    lifetimeMs,
    expiresInMinutes: lifetimeMs / 60_000,
    withRefreshToken,
  }
}

/**
 * Serialize the browser cookie from the lifetime reported by token issuance.
 * This prevents a cookie from outliving or prematurely hiding its credential.
 */
export function authCookieForBrowserSession(token: string, expiresIn: number | undefined): string {
  const seconds = Number(expiresIn)
  if (!Number.isInteger(seconds) || seconds <= 0)
    throw new TypeError('[auth] The issued token lifetime must be a positive integer number of seconds.')
  return authCookie(token, { maxAge: seconds })
}

type HeaderRequest = { headers?: { get: (name: string) => string | null } }

interface MediaPreference {
  order: number
  quality: number
  specificity: number
}

function mediaPreference(accept: string, mediaType: string): MediaPreference {
  const requested = mediaType.toLowerCase()
  const requestedType = requested.slice(0, requested.indexOf('/'))
  let best: MediaPreference = { order: Number.POSITIVE_INFINITY, quality: 0, specificity: -1 }

  for (const [order, raw] of accept.split(',').entries()) {
    const [rawType = '', ...parameters] = raw.trim().toLowerCase().split(';')
    const type = rawType.trim()
    if (type !== requested && type !== `${requestedType}/*` && type !== '*/*')
      continue
    const qualityParameter = parameters.find(parameter => parameter.trim().startsWith('q='))
    const quality = qualityParameter === undefined
      ? 1
      : Number(qualityParameter.slice(qualityParameter.indexOf('=') + 1).trim())
    const normalizedQuality = Number.isFinite(quality) && quality >= 0 && quality <= 1 ? quality : 0
    const specificity = type === requested ? 2 : type === `${requestedType}/*` ? 1 : 0
    if (specificity > best.specificity || (specificity === best.specificity && normalizedQuality > best.quality))
      best = { order, quality: normalizedQuality, specificity }
  }

  return best
}

function prefersHtml(accept: string | null): boolean {
  if (!accept)
    return false
  const html = mediaPreference(accept, 'text/html')
  const json = mediaPreference(accept, 'application/json')
  return html.quality > 0 && (
    html.quality > json.quality
    || (html.quality === json.quality && html.order < json.order)
  )
}

/** Resolve a configured same-origin logout target for HTML navigation only. */
export function browserSessionLogoutRedirect(
  request: HeaderRequest | undefined,
  auth: BrowserSessionPolicyConfig = config.auth,
): string | undefined {
  if (!prefersHtml(request?.headers?.get('accept') ?? null))
    return undefined

  const configured = auth.browserSession?.logoutRedirect
  if (typeof configured !== 'string')
    return undefined
  const candidate = configured.trim()
  if (!candidate.startsWith('/') || candidate.startsWith('//'))
    return undefined

  try {
    const base = new URL('https://stacks.invalid')
    const resolved = new URL(candidate, base)
    if (resolved.origin !== base.origin)
      return undefined
    const target = `${resolved.pathname}${resolved.search}${resolved.hash}`
    if (!target.startsWith('/') || target.startsWith('//'))
      return undefined
    return target
  }
  catch {
    return undefined
  }
}
