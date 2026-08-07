/**
 * stacksjs/stacks#2236 — the auth cookie had two names and they never met.
 *
 * `authCookie()` wrote `stacks_auth`, resolved from `config.auth.cookie.name`,
 * a key that did not exist on `AuthOptions` — so no app closing its config with
 * `satisfies AuthConfig` could even set it, and the documented override was
 * unreachable. Meanwhile the framework default Auth middleware, the userland
 * middleware, `team.ts`'s team resolver and the stx page gate all read
 * `config.auth.defaultTokenName`, i.e. `auth-token`.
 *
 * So a cookie the framework set was never a cookie the framework read. Nothing
 * called `authCookie()` at all, which is how it survived: the whole cookie
 * handoff was shipped, exported from `@stacksjs/auth`, documented with a
 * worked example — and inert. Apps that wanted a browser session after an
 * OAuth redirect had no working path, and hand-serialized a token pack into
 * `localStorage` from an inline `<script>` instead.
 *
 * The existing cookie-auth test could not catch it: it fed `authCookie()`'s
 * output straight back into `authCookieToken()`, so both halves agreed with
 * each other while agreeing with nothing else. These tests check the name
 * against the readers.
 */

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { authCookie, authCookieName, authCookieToken } from '../src/cookie-auth'

const REPO_ROOT = join(import.meta.dir, '../../../../..')

function source(relative: string): string {
  return readFileSync(join(REPO_ROOT, relative), 'utf-8')
}

describe('authCookieName', () => {
  it('is the name every reader looks for', () => {
    expect(authCookieName()).toBe('auth-token')
  })

  it('honours an explicit override', () => {
    expect(authCookieName({ name: 'session' })).toBe('session')
  })
})

describe('the writer and the readers agree (#2236)', () => {
  it('round-trips through the cookie header', () => {
    const header = authCookie('tok_123')
    const request = new Request('https://example.com/', {
      headers: { cookie: header.split(';')[0]! },
    })

    expect(authCookieToken(request)).toBe('tok_123')
  })

  it('writes the name the Auth middleware reads', () => {
    // The middleware resolves its name at runtime, so assert on the source:
    // it must go through the shared resolver rather than recomputing one.
    const middleware = source('storage/framework/defaults/app/Middleware/Auth.ts')

    expect(middleware).toContain('authCookieName()')
    expect(middleware).not.toContain(`defaultTokenName || 'auth-token'`)
  })

  it('writes the name the team resolver reads', () => {
    const team = source('storage/framework/core/auth/src/team.ts')

    expect(team).toContain('authCookieName()')
    expect(team).not.toContain(`defaultTokenName || 'auth-token'`)
  })

  it('writes the name the scaffold middleware reads', () => {
    const scaffold = source('app/Middleware/Auth.ts')

    expect(scaffold).toContain('authCookieName()')
    expect(scaffold).not.toContain(`defaultTokenName || 'auth-token'`)
  })

  it('writes the name the stx page gate is configured with', () => {
    const views = source('storage/framework/core/actions/src/dev/views.ts')

    expect(views).toContain('authCookieName()')
    expect(views).not.toContain(`defaultTokenName ?? 'auth-token'`)
  })

  it('no reader recomputes the name from defaultTokenName', () => {
    // The specific shape of the bug: four separate sites each deriving a
    // cookie name from a key that is a per-token label. If one of them drifts
    // back, the handoff silently breaks again for exactly one of them, which
    // is the hardest version of this to debug.
    for (const file of [
      'storage/framework/defaults/app/Middleware/Auth.ts',
      'storage/framework/core/auth/src/team.ts',
      'app/Middleware/Auth.ts',
      'storage/framework/core/actions/src/dev/views.ts',
    ]) {
      expect(source(file)).not.toMatch(/defaultTokenName\s*[|?]{2}\s*['"]auth-token['"]/)
    }
  })
})

describe('defaultTokenName is a token label, not a cookie name', () => {
  it('is still what createTokenForUser writes to the row', () => {
    // The overload is only safe to unwind if the label use survives intact.
    const authentication = source('storage/framework/core/auth/src/authentication.ts')

    expect(authentication).toContain(`config.auth.defaultTokenName ?? 'auth-token'`)
  })
})
