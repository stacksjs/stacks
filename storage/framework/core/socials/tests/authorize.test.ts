import { describe, expect, it } from 'bun:test'
import {
  AUTHORIZE_HOST,
  AUTHORIZE_PATH,
  callbackPage,
  callbackUri,
  envLines,
  isAuthorizablePlatform,
  newState,
  readCallback,
  TWITTER_PUBLISH_SCOPES,
} from '../src/authorize'

/**
 * The consent flow's own decisions.
 *
 * Each one is reachable only by sitting at a browser with a live X app
 * registered, so left in the command they would be checked once by hand and
 * never again (stacksjs/stacks#2873).
 */

describe('the scopes X is asked for', () => {
  it('asks for offline.access, without which there is no refresh token', () => {
    // The expensive one to forget: without it the access token expires in a
    // couple of hours and nothing can renew it, which looks like the
    // integration breaking overnight rather than a missing scope.
    expect(TWITTER_PUBLISH_SCOPES).toContain('offline.access')
  })

  it('asks for what posting and naming the account need, and nothing more', () => {
    // `users.read` is what lets the flow report WHICH account was authorized.
    expect([...TWITTER_PUBLISH_SCOPES].sort()).toEqual(['offline.access', 'tweet.read', 'tweet.write', 'users.read'])
  })
})

describe('callbackUri', () => {
  it('is the literal loopback address, not localhost', () => {
    // X requires the literal loopback address for a native redirect, and the
    // two are not interchangeable to the string comparison the platform does
    // even though they resolve to the same host.
    expect(callbackUri(7731)).toBe('http://127.0.0.1:7731/callback')
    expect(AUTHORIZE_HOST).toBe('127.0.0.1')
    expect(callbackUri(7731).startsWith(`http://${AUTHORIZE_HOST}`)).toBe(true)
    expect(callbackUri(7731).endsWith(AUTHORIZE_PATH)).toBe(true)
  })

  it('refuses something that is not a port', () => {
    for (const port of [0, -1, 65_536, 1.5, Number.NaN])
      expect(() => callbackUri(port)).toThrow('not a port')
  })
})

describe('newState', () => {
  it('is long and different every time', () => {
    const states = new Set(Array.from({ length: 50 }, () => newState()))
    expect(states.size).toBe(50)
    for (const state of states)
      expect(state).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('readCallback', () => {
  const state = 'a'.repeat(32)
  const at = (query: string) => `http://127.0.0.1:7731/callback?${query}`

  it('takes the code when the state matches', () => {
    expect(readCallback(at(`code=abc123&state=${state}`), state)).toEqual({ ok: true, code: 'abc123' })
  })

  it('refuses a state that does not match, before using the code', () => {
    // The state is the only thing distinguishing this run's redirect from one
    // another local process aimed at the listener, and the listener is on a
    // loopback port any of them can reach.
    const verdict = readCallback(at(`code=abc123&state=${'b'.repeat(32)}`), state)
    expect(verdict).toMatchObject({ ok: false, reason: 'state-mismatch' })
  })

  it('refuses a missing state, and an empty expectation', () => {
    expect(readCallback(at('code=abc123'), state)).toMatchObject({ ok: false, reason: 'state-mismatch' })
    // An empty expectation must never match an empty arrival.
    expect(readCallback(at('code=abc123&state='), '')).toMatchObject({ ok: false, reason: 'state-mismatch' })
  })

  it('reports a declined consent as declined, with what the platform said', () => {
    const verdict = readCallback(at(`error=access_denied&error_description=User+denied&state=${state}`), state)
    expect(verdict).toMatchObject({ ok: false, reason: 'declined' })
    expect((verdict as { message: string }).message).toContain('access_denied')
    expect((verdict as { message: string }).message).toContain('User denied')
  })

  it('reads an error before it reads the state', () => {
    // A declined consent may come back without a usable state. Reporting
    // "wrong state" there would send the operator after the wrong problem.
    expect(readCallback(at('error=access_denied'), state)).toMatchObject({ ok: false, reason: 'declined' })
  })

  it('ignores a request for anything but the callback path', () => {
    // A browser asks for /favicon.ico unprompted, and resolving the flow on
    // it would end the run before the redirect arrived.
    expect(readCallback('http://127.0.0.1:7731/favicon.ico', state)).toMatchObject({ ok: false, reason: 'not-the-callback' })
    expect(readCallback('http://127.0.0.1:7731/', state)).toMatchObject({ ok: false, reason: 'not-the-callback' })
    expect(readCallback('nonsense', state)).toMatchObject({ ok: false, reason: 'not-the-callback' })
  })

  it('refuses a callback with a matching state and no code', () => {
    expect(readCallback(at(`state=${state}`), state)).toMatchObject({ ok: false, reason: 'no-code' })
  })
})

describe('envLines', () => {
  it('spells the variables an operator has to set', () => {
    expect(envLines('home-lang', 'twitter', { accessToken: 'AT', refreshToken: 'RT' })).toEqual([
      'SOCIALS_HOMELANG_TWITTER_ACCESS_TOKEN=AT',
      'SOCIALS_HOMELANG_TWITTER_REFRESH_TOKEN=RT',
    ])
  })

  it('leaves out a value that is not there', () => {
    // No refresh token means no line, rather than a line that sets it empty
    // and reads as configured.
    expect(envLines('stacks', 'twitter', { accessToken: 'AT', refreshToken: undefined })).toEqual([
      'SOCIALS_STACKS_TWITTER_ACCESS_TOKEN=AT',
    ])
    expect(envLines('stacks', 'twitter', { accessToken: 'AT', refreshToken: '' })).toHaveLength(1)
  })
})

describe('isAuthorizablePlatform', () => {
  it('claims only the platform the flow has actually run', () => {
    // LinkedIn, Instagram and Threads each have their own consent pair and
    // their own input shape. Claiming a generic flow that has only ever run
    // against X would be a worse starting point than an honest single one.
    expect(isAuthorizablePlatform('twitter')).toBe(true)
    for (const platform of ['bluesky', 'mastodon', 'linkedin', 'instagram', 'threads'] as const)
      expect(isAuthorizablePlatform(platform), platform).toBe(false)
  })
})

describe('callbackPage', () => {
  it('escapes what it is given', () => {
    // The detail can carry a platform's error description, which is remote
    // text rendered in the operator's browser.
    const html = callbackPage('Done', '<script>alert(1)</script>')
    expect(html).not.toContain('<script>alert')
    expect(html).toContain('&lt;script&gt;')
  })

  it('is a complete document, so the browser does not render quirks', () => {
    const html = callbackPage('Authorized', 'You can close this tab.')
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<meta charset="utf-8">')
    expect(html).toContain('You can close this tab.')
  })
})
