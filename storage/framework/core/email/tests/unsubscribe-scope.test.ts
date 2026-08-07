/**
 * Scoped unsubscribe tokens (stacksjs/stacks#1880 follow-up).
 *
 * The original token said only "this address". That is the right answer for a
 * newsletter and the wrong one for anything that notifies per thread: a forge
 * sends about a pull request, and somebody clicking Unsubscribe in that email
 * means "stop telling me about this one", not "never email me again". Without a
 * scope the application has to mint its own token beside this one, and then two
 * signing schemes exist for the same button.
 *
 * The scope is *inside* the signed payload rather than beside it in the URL. A
 * scope carried as a query parameter is one anybody can edit, and editing it
 * from "this pull request" to "everything" is a one-character attack on
 * somebody else's notification settings.
 *
 * Absent means the whole address, which is what every token minted before this
 * existed means - so old links keep working and keep meaning what they meant.
 */

import { describe, expect, it } from 'bun:test'
import {
  buildListUnsubscribeHeaders,
  buildUnsubscribeUrl,
  createUnsubscribeToken,
  verifyUnsubscribeToken,
} from '../src/unsubscribe'

describe('a scoped token', () => {
  it('carries the scope back out', () => {
    const token = createUnsubscribeToken('reader@example.com', 3600, 'pull_request:42')
    const result = verifyUnsubscribeToken(token)

    expect(result.valid).toBe(true)
    expect(result.email).toBe('reader@example.com')
    expect(result.scope).toBe('pull_request:42')
  })

  it('an unscoped token still verifies, and says nothing about scope', () => {
    // Every token minted before this existed is unscoped. Reading absence as
    // anything other than "the whole address" would silently change what those
    // links do.
    const result = verifyUnsubscribeToken(createUnsubscribeToken('reader@example.com', 3600))

    expect(result.valid).toBe(true)
    expect(result.scope).toBeUndefined()
  })

  it('the scope is signed, so editing it invalidates the token', () => {
    // The whole reason it is not a query parameter.
    const token = createUnsubscribeToken('reader@example.com', 3600, 'pull_request:42')
    const [payload, signature] = token.split('.')
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))

    claims.scope = 'everything'

    const forged = `${Buffer.from(JSON.stringify(claims)).toString('base64url')}.${signature}`

    expect(verifyUnsubscribeToken(forged)).toEqual({ valid: false, reason: 'bad_signature' })
  })

  it('two scopes for one address are different tokens', () => {
    const a = createUnsubscribeToken('reader@example.com', 3600, 'pull_request:1')
    const b = createUnsubscribeToken('reader@example.com', 3600, 'pull_request:2')

    expect(a).not.toBe(b)
    expect(verifyUnsubscribeToken(a).scope).toBe('pull_request:1')
    expect(verifyUnsubscribeToken(b).scope).toBe('pull_request:2')
  })

  it('an empty scope is the same as no scope', () => {
    // Otherwise a caller passing a computed value that happened to be empty
    // would mint a token claiming to be scoped to nothing at all.
    expect(verifyUnsubscribeToken(createUnsubscribeToken('reader@example.com', 3600, '')).scope).toBeUndefined()
  })

  it('expiry still applies', () => {
    expect(verifyUnsubscribeToken(createUnsubscribeToken('reader@example.com', -1, 'issue:9')))
      .toEqual({ valid: false, reason: 'expired' })
  })
})

describe('the URL and the headers', () => {
  it('carry the scope through', () => {
    const url = buildUnsubscribeUrl('reader@example.com', 3600, {
      baseUrl: 'https://forge.example',
      scope: 'pull_request:42',
    })

    const token = url.slice(url.lastIndexOf('/') + 1)

    expect(url.startsWith('https://forge.example')).toBe(true)
    expect(verifyUnsubscribeToken(token).scope).toBe('pull_request:42')
  })

  it('the one-click headers are scoped too', () => {
    // Gmail's native Unsubscribe button posts to this URL. If it were unscoped
    // while the footer link was scoped, the button and the link would do
    // different things - and the button is the one most people press.
    const headers = buildListUnsubscribeHeaders('reader@example.com', 3600, {
      baseUrl: 'https://forge.example',
      scope: 'issue:7',
    })

    const url = headers['List-Unsubscribe'].replace(/^<|>$/g, '')
    const token = url.slice(url.lastIndexOf('/') + 1)

    expect(verifyUnsubscribeToken(token).scope).toBe('issue:7')
    expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
  })
})
