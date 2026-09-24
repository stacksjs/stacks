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
