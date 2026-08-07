// Moving a server-minted session into the browser (stacksjs/stacks#2236).
//
// `@stacksjs/socials` stopped at the provider user and `@stacksjs/auth` did
// `loginUsingId()`; nothing bridged them for a browser. So an app's callback
// action ended by returning an HTML page whose inline script wrote the
// framework's own storage keys:
//
//     localStorage.setItem('token', JSON.stringify(JSON.stringify(token)))
//
// The double stringify is not a typo — `useStorage` JSON-stringifies on write.
// One app got it wrong for `user` and stored the literal `[object Object]`, so
// every social sign-in produced a broken session. The same script needed
// hand-written escaping so a display name containing a closing script tag
// could not terminate the block.
//
// A 302 with the pack in the fragment removes all of it: no HTML, no inline
// script, no escaping, and the tokens never appear in a response body.

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildSessionHandoffUrl,
  decodeSessionHandoff,
  encodeSessionHandoff,
  readSessionHandoff,
  stripSessionHandoff,
} from '../../composables/src/session-handoff'
import { isSafeHandoffTarget, socialHandoffFailureRedirect, socialHandoffRedirect } from '../src/handoff'

const PACK = {
  token: 'access-abc',
  refreshToken: 'refresh-xyz',
  user: { id: 1, email: 'a@b.com', name: 'Ada' },
  expiresIn: 3600,
}

describe('the pack survives the round trip (#2236)', () => {
  it('encodes and decodes', () => {
    expect(decodeSessionHandoff(encodeSessionHandoff(PACK))).toEqual(PACK)
  })

  it('carries the user as an OBJECT, not a coerced string', () => {
    // The concrete bug: `setItem('user', {...})` coerced to "[object Object]",
    // so `session.user()` was that string rather than a user.
    const decoded = decodeSessionHandoff(encodeSessionHandoff(PACK))
    expect(typeof decoded!.user).toBe('object')
    expect((decoded!.user as any).email).toBe('a@b.com')
  })

  it('survives a display name that would have broken an inline script', () => {
    // `</script>` in a name terminated the hand-built block early, which is
    // why the app carried an escaping helper. There is no script here.
    const pack = { ...PACK, user: { name: '</script><img src=x onerror=alert(1)>' } }
    const decoded = decodeSessionHandoff(encodeSessionHandoff(pack))
    expect((decoded!.user as any).name).toBe('</script><img src=x onerror=alert(1)>')
  })

  it('survives non-ASCII', () => {
    // btoa throws on characters above U+00FF unless the value is encoded to
    // bytes first — a name in any non-Latin script would have crashed the
    // callback.
    const pack = { ...PACK, user: { name: '日本語 — Ünïcödé 🎉' } }
    expect((decodeSessionHandoff(encodeSessionHandoff(pack))!.user as any).name)
      .toBe('日本語 — Ünïcödé 🎉')
  })

  it('is URL-safe', () => {
    const encoded = encodeSessionHandoff({ ...PACK, token: 'a+b/c=d?e#f&g' })
    expect(encoded).not.toMatch(/[+/=]/)
    expect(decodeSessionHandoff(encoded)!.token).toBe('a+b/c=d?e#f&g')
  })

  it('accepts access_token as well as token', () => {
    const encoded = btoa(JSON.stringify({ access_token: 'from-oauth-shape' }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(decodeSessionHandoff(encoded)!.token).toBe('from-oauth-shape')
  })
})

describe('a malformed handoff is ignored, not thrown (#2236)', () => {
  // This runs on a value an attacker can put in a URL. A throw on page load
  // would be a denial of service on the destination page.
  it('returns null for junk', () => {
    for (const value of ['', null, undefined, 'not-base64!!', btoa('not json')])
      expect(decodeSessionHandoff(value as any)).toBeNull()
  })

  it('returns null when there is no access token', () => {
    // Half-applying a pack would leave a session that looks signed in and
    // cannot authenticate.
    const encoded = encodeSessionHandoff({ token: '', user: { id: 1 } } as any)
    expect(decodeSessionHandoff(encoded)).toBeNull()
  })
})

describe('the redirect URL (#2236)', () => {
  it('puts the pack in the fragment', () => {
    // Fragments are never sent to a server: out of access logs, out of
    // Referer, out of every proxy in between — none of which was true of an
    // HTML body carrying the same tokens.
    const url = buildSessionHandoffUrl('/account', PACK)
    expect(url.startsWith('/account#stx_auth=')).toBeTrue()
    expect(url).not.toContain('?')
  })

  it('preserves a fragment the target already had', () => {
    const url = buildSessionHandoffUrl('/account#billing', PACK)
    expect(url).toContain('billing')
    expect(readSessionHandoff(url.slice(url.indexOf('#')))).toEqual(PACK)
  })

  it('round-trips through readSessionHandoff', () => {
    const url = buildSessionHandoffUrl('/account', PACK)
    expect(readSessionHandoff(url.slice(url.indexOf('#')))).toEqual(PACK)
  })

  it('strips cleanly, leaving nothing behind', () => {
    expect(stripSessionHandoff(`#stx_auth=${encodeSessionHandoff(PACK)}`)).toBe('')
  })

  it('strips without eating the rest of the fragment', () => {
    const hash = `#billing&stx_auth=${encodeSessionHandoff(PACK)}`
    expect(stripSessionHandoff(hash)).toBe('#billing=')
  })
})

describe('refusing an unsafe redirect target (#2236)', () => {
  // The target can come from user input — the state blob, a `?next=` — and
  // this redirect carries a token pack.
  it('allows a relative path', () => {
    expect(isSafeHandoffTarget('/account')).toBeTrue()
  })

  it('rejects a protocol-relative URL', () => {
    // `//evil.example` is an absolute URL wearing a relative costume, and the
    // single most missed case in redirect validation.
    expect(isSafeHandoffTarget('//evil.example/steal')).toBeFalse()
  })

  it('rejects an absolute URL by default', () => {
    expect(isSafeHandoffTarget('https://evil.example/steal')).toBeFalse()
  })

  it('allows an absolute URL only when its host is named', () => {
    expect(isSafeHandoffTarget('https://app.example.com/account', ['app.example.com'])).toBeTrue()
    expect(isSafeHandoffTarget('https://evil.example/steal', ['app.example.com'])).toBeFalse()
  })

  it('rejects javascript: and data:', () => {
    // How a redirect becomes script execution.
    expect(isSafeHandoffTarget('javascript:alert(1)', ['x'])).toBeFalse()
    expect(isSafeHandoffTarget('data:text/html,<script>', ['x'])).toBeFalse()
  })

  it('rejects empty', () => {
    expect(isSafeHandoffTarget('')).toBeFalse()
  })
})

describe('socialHandoffRedirect (#2236)', () => {
  it('is a 302 to the target, carrying the pack', () => {
    const res = socialHandoffRedirect(PACK, { redirectTo: '/account' })
    expect(res.status).toBe(302)
    const location = res.headers.get('Location')!
    expect(location.startsWith('/account#')).toBeTrue()
    expect(readSessionHandoff(location.slice(location.indexOf('#')))).toEqual(PACK)
  })

  it('has no body — nothing to escape', () => {
    expect(socialHandoffRedirect(PACK).body).toBeNull()
  })

  it('is not cacheable', () => {
    // The Location header carries the pack; a cached 302 would replay one
    // visitor's session to the next.
    expect(socialHandoffRedirect(PACK).headers.get('Cache-Control')).toBe('no-store')
  })

  it('throws rather than redirecting somewhere unsafe', () => {
    expect(() => socialHandoffRedirect(PACK, { redirectTo: 'https://evil.example' })).toThrow(/refusing/)
  })

  it('honours an allowed host', () => {
    const res = socialHandoffRedirect(PACK, {
      redirectTo: 'https://app.example.com/account',
      allowedHosts: ['app.example.com'],
    })
    expect(res.headers.get('Location')!.startsWith('https://app.example.com/account#')).toBeTrue()
  })
})

describe('the failure path is shipped too (#2236)', () => {
  // It was the OTHER hand-built inline script in the reporting app — same
  // escaping hazard, for a message that often contains provider text.
  it('redirects with the reason as a query parameter', () => {
    const res = socialHandoffFailureRedirect('access_denied', { redirectTo: '/login' })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/login?social_error=access_denied')
  })

  it('encodes a reason containing markup', () => {
    const res = socialHandoffFailureRedirect('</script><b>x', { redirectTo: '/login' })
    expect(res.headers.get('Location')).not.toContain('<')
  })

  it('appends to an existing query', () => {
    const res = socialHandoffFailureRedirect('nope', { redirectTo: '/login?next=/app' })
    expect(res.headers.get('Location')).toBe('/login?next=/app&social_error=nope')
  })

  it('carries no token pack', () => {
    expect(socialHandoffFailureRedirect('nope').headers.get('Location')).not.toContain('stx_auth')
  })
})

describe('the browser side is a supported call (#2236 ask 3)', () => {
  const useAuthSource = readFileSync(
    join(import.meta.dir, '../../browser/src/composables/useAuth.ts'),
    'utf8',
  )

  it('useAuth exposes completeSocialLogin', () => {
    expect(useAuthSource).toContain('completeSocialLogin')
  })

  it('it writes through the storage refs, never localStorage directly', () => {
    // The whole point. `token.value = …` applies useStorage's encoding; a
    // direct `localStorage.setItem` is what forced apps to know about the
    // double stringify and got `user` stored as "[object Object]".
    expect(useAuthSource).toContain('token.value = resolved.token')
    expect(useAuthSource).not.toContain('localStorage.setItem')
  })

  it('it strips the fragment after reading it', () => {
    // A fragment is not sent to servers, but it is in browser history.
    expect(useAuthSource).toContain('stripSessionHandoff')
    expect(useAuthSource).toContain('replaceState')
  })

  it('the README points at the helpers instead of leaving them to be rediscovered', () => {
    // Ask 5: an app hand-rolled an HMAC next to a shipped constant-time
    // validateState() because nothing pointed at it.
    const readme = readFileSync(join(import.meta.dir, '../README.md'), 'utf8')
    expect(readme).toContain('validateState')
    expect(readme).toContain('socialHandoffRedirect')
  })
})
