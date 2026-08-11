/**
 * Every action that starts a browser session must set the auth cookie, and
 * every action that ends one must clear it.
 *
 * The bug this pins (#2306): `SocialCallbackAction` set the cookie and nothing
 * else did, so how a browser ended up signed in depended on which way it signed
 * in. OAuth left a cookie; email+password left only JSON, which a
 * server-rendered page cannot read — it posts a form, follows a redirect, and
 * comes back carrying nothing but cookies. The first authenticated document
 * render therefore had no way to identify the user.
 *
 * This is a contract over the shipped defaults rather than an HTTP test because
 * there is no harness that invokes an Action and inspects its response headers.
 * It asserts the requirement (this path handles the session cookie) rather than
 * how it is written, so it survives refactors while still failing if a new
 * sign-in path is added without one.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ACTIONS = 'storage/framework/defaults/app/Actions/Auth'

function action(name: string): string {
  return readFileSync(resolve(`${ACTIONS}/${name}.ts`), 'utf8')
}

/** Actions that hand a browser a live session and must therefore set it. */
const SESSION_ISSUING = [
  'LoginAction',
  'VerifyTwoFactorLoginAction',
  'RegisterAction',
  'SocialCallbackAction',
]

describe('auth session cookie contract (#2306)', () => {
  test.each(SESSION_ISSUING)('%s sets the auth cookie', (name) => {
    expect(action(name)).toMatch(/authCookie\(/)
  })

  test('the 2FA path is covered, not just the password path', () => {
    // LoginAction deliberately mints no token for a 2FA account — it returns a
    // challenge — so covering only LoginAction would leave every 2FA user
    // exactly where they started.
    const login = action('LoginAction')
    expect(login).toContain('requires_two_factor: true')
    expect(action('VerifyTwoFactorLoginAction')).toMatch(/authCookie\(/)
  })

  test('rotation re-sets the cookie so it cannot go stale', () => {
    // Refreshing invalidates the token the cookie was carrying. Leaving it
    // untouched would expire the browser's session at the exact moment it was
    // meant to be extended.
    expect(action('RefreshTokenAction')).toMatch(/authCookie\(/)
  })

  test.each(['LogoutAction', 'LogoutAllAction'])('%s clears the auth cookie', (name) => {
    expect(action(name)).toMatch(/clearAuthCookie\(/)
  })

  test('minting an API token does not start a browser session', () => {
    // CreateTokenAction issues a personal access token the caller will send as
    // a bearer header. A cookie there would sign the browser in as a side
    // effect of asking for an API credential.
    expect(action('CreateTokenAction')).not.toMatch(/authCookie\(/)
  })

  test('the JSON body still carries the token for API clients', () => {
    // The cookie is additive. A client that ignores Set-Cookie must behave
    // exactly as it did before, so the OAuth2 payload stays intact.
    for (const name of ['LoginAction', 'VerifyTwoFactorLoginAction', 'RegisterAction']) {
      const source = action(name)
      expect(source).toContain('access_token:')
      expect(source).toContain('refresh_token:')
      expect(source).toContain("token_type: 'Bearer'")
    }
  })
})
