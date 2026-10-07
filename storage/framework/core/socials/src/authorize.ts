import type { SocialCredentialPlatform } from '@stacksjs/types'
import { randomBytes } from 'node:crypto'
import { TwitterPublishingDriver } from './drivers/twitter'
import { envName, SocialIdentityError } from './identities'

/**
 * Running a consent flow from a terminal, so an identity can be authorized
 * without a dashboard.
 *
 * X is the reason this exists. Bluesky's app password and Mastodon's manually
 * generated token are long-lived values an operator can paste into `.env`
 * complete; X posts with a user-context OAuth 2.0 token, so the access and
 * refresh tokens come out of a consent flow and cannot be prepared ahead of
 * time (stacksjs/stacks#2873). Declaring the platform without them leaves an
 * identity that reports it is not authorized, which is honest and not
 * useful.
 *
 * The driver already had every piece: `createAuthorization` with PKCE,
 * `exchangeCode`, `refreshAccessToken` and `getProfile`. What was missing is
 * the half a human is part of: somewhere for the browser to come back to, and
 * the values printed in a form that can be put in `.env`.
 *
 * LinkedIn, Instagram and Threads have the same property and their own
 * `getAuthUrl` / `exchangeCode` pairs. They are NOT wired up here: each
 * takes a different input shape and needs its own app registration, and
 * claiming a generic flow that has only ever run against one platform would
 * be a worse starting point than an honest single one.
 */

/** The platforms this flow can run. */
export type AuthorizablePlatform = 'twitter'

export function isAuthorizablePlatform(platform: SocialCredentialPlatform): platform is AuthorizablePlatform {
  return platform === 'twitter'
}

/**
 * The scopes X needs to post as the authorized account.
 *
 * `offline.access` is the one that is easy to miss and expensive to miss:
 * without it X issues no refresh token, so the access token expires in two
 * hours and the identity has to be re-authorized by hand. `users.read` is
 * what makes `getProfile` work, which is how the flow can report WHICH
 * account was just authorized rather than only that one was.
 */
export const TWITTER_PUBLISH_SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'] as const

/** Loopback, so the redirect never leaves the machine running the flow. */
export const AUTHORIZE_HOST = '127.0.0.1'
export const AUTHORIZE_PATH = '/callback'

/**
 * The redirect URI, which has to match the one registered with the platform
 * exactly, character for character.
 *
 * `127.0.0.1` rather than `localhost`: X requires the literal loopback
 * address for a native app's redirect, and the two are not interchangeable to
 * a URI string comparison even though they resolve to the same host.
 */
export function callbackUri(port: number): string {
  if (!Number.isInteger(port) || port < 1 || port > 65_535)
    throw new SocialIdentityError(`${port} is not a port a redirect can listen on.`)
  return `http://${AUTHORIZE_HOST}:${port}${AUTHORIZE_PATH}`
}

/** An unguessable `state`, which is what ties a redirect to this run. */
export function newState(): string {
  return randomBytes(16).toString('hex')
}

export type CallbackReading =
  | { ok: true, code: string }
  | { ok: false, reason: 'not-the-callback' | 'declined' | 'state-mismatch' | 'no-code', message: string }

/**
 * What came back on the redirect.
 *
 * `state` is checked before the code is used, and a mismatch is refused
 * rather than logged: the state is the only thing distinguishing the redirect
 * this run started from one somebody else aimed at the listener, and this
 * listener is on a loopback port any local process can reach.
 */
export function readCallback(url: string, expectedState: string): CallbackReading {
  let parsed: URL
  try {
    parsed = new URL(url)
  }
  catch {
    return { ok: false, reason: 'not-the-callback', message: `Not a URL: ${url}` }
  }

  if (parsed.pathname !== AUTHORIZE_PATH)
    return { ok: false, reason: 'not-the-callback', message: `Ignoring a request for ${parsed.pathname}.` }

  const error = parsed.searchParams.get('error')
  if (error) {
    const description = parsed.searchParams.get('error_description')
    return { ok: false, reason: 'declined', message: description ? `${error}: ${description}` : error }
  }

  const state = parsed.searchParams.get('state') ?? ''
  if (!expectedState || state !== expectedState)
    return { ok: false, reason: 'state-mismatch', message: 'The redirect carried the wrong state, so it did not come from this run.' }

  const code = parsed.searchParams.get('code') ?? ''
  if (!code)
    return { ok: false, reason: 'no-code', message: 'The redirect carried no authorization code.' }

  return { ok: true, code }
}

/**
 * The lines to put in `.env`, in the order they are most usefully pasted.
 *
 * Printed rather than written. `.env` may be encrypted, `buddy env:set` owns
 * writing to it, and a token passed as a shell argument lands in shell
 * history, which is a worse place for it than a gitignored file.
 */
export function envLines(
  identity: string,
  platform: SocialCredentialPlatform,
  values: Record<string, string | undefined>,
): string[] {
  const lines: string[] = []
  for (const [field, value] of Object.entries(values)) {
    if (!value) continue
    lines.push(`${envName(identity, platform, field)}=${value}`)
  }
  return lines
}

export interface AuthorizedIdentity {
  /** The account that was authorized, so the operator can see it is the right one. */
  handle: string
  accountId: string
  accessToken: string
  refreshToken?: string
  /** Seconds, as the platform reported it. */
  expiresIn?: number
  scope?: string
  /** Whether a refresh token came back. False means re-authorizing by hand, repeatedly. */
  renewable: boolean
}

export interface AuthorizeTwitterInput {
  clientId: string
  clientSecret?: string
  redirectUrl: string
  code: string
  codeVerifier: string
}

/**
 * Finish the flow: code to tokens to the account they belong to.
 *
 * Separate from the listener so the exchange can be driven by anything that
 * has a code, a dashboard route included.
 */
export async function completeTwitterAuthorization(input: AuthorizeTwitterInput): Promise<AuthorizedIdentity> {
  const driver = new TwitterPublishingDriver()
  const token = await driver.exchangeCode(input)

  if (!token.accessToken)
    throw new SocialIdentityError('X returned no access token for that code.')

  // Named here rather than left for the operator to notice: without
  // `offline.access` the token expires in a couple of hours and there is
  // nothing to renew it with, which looks like the integration breaking
  // overnight.
  const renewable = Boolean(token.refreshToken)

  const profile = await driver.getProfile(token.accessToken)

  return {
    handle: profile.username,
    accountId: profile.id,
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresIn: token.expiresIn,
    scope: token.scope,
    renewable,
  }
}

/** The consent URL to open, and the verifier the exchange needs back. */
export async function startTwitterAuthorization(input: {
  clientId: string
  redirectUrl: string
  state: string
}): Promise<{ url: string, codeVerifier: string }> {
  return new TwitterPublishingDriver().createAuthorization({
    clientId: input.clientId,
    redirectUrl: input.redirectUrl,
    scopes: [...TWITTER_PUBLISH_SCOPES],
    state: input.state,
  })
}

/** What the browser is shown once the redirect lands, so it does not look broken. */
export function callbackPage(title: string, detail: string): string {
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escape(title)}</title>`
    + `<style>body{font:16px/1.5 system-ui,sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;color:#111}`
    + `main{max-width:28rem;padding:2rem;text-align:center}h1{font-size:1.25rem;margin:0 0 .5rem}p{margin:0;color:#555}`
    + `@media(prefers-color-scheme:dark){body{background:#111;color:#eee}p{color:#aaa}}</style></head>`
    + `<body><main><h1>${escape(title)}</h1><p>${escape(detail)}</p></main></body></html>`
}
