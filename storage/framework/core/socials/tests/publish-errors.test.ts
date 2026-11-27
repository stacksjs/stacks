import { describe, expect, it } from 'bun:test'
import { BlueskyApiError, isBlueskySessionError } from '../src/drivers/bluesky'
import { TwitterApiError } from '../src/drivers/twitter'
import { classifySocialError, isExpiredSignIn, networkReason } from '../src/publish-errors'

describe('networkReason', () => {
  it('finds the network\'s own sentence in the shapes the networks use', () => {
    expect(networkReason('{"detail":"You are not allowed to create a Tweet with duplicate content."}'))
      .toBe('You are not allowed to create a Tweet with duplicate content')
    expect(networkReason('{"error":{"message":"Invalid parameter value here","code":100}}')).toBe('Invalid parameter value here')
    expect(networkReason('{"errors":[{"message":"Media type unsupported for this post"}]}')).toBe('Media type unsupported for this post')
  })

  it('gives nothing for a code, a dump or something that is not JSON', () => {
    expect(networkReason('{"error":"InvalidRequest"}')).toBe('')
    expect(networkReason('<html>bad gateway</html>')).toBe('')
    expect(networkReason(undefined)).toBe('')
  })
})

describe('classifySocialError', () => {
  it('does not call a duplicate post on X an expired sign-in', () => {
    const error = new TwitterApiError('Twitter API failed (403)', 403, '{"detail":"You are not allowed to create a Tweet with duplicate content."}')
    expect(error.isAuthError).toBe(false)
    expect(classifySocialError(error).kind).toBe('duplicate')
    expect(isExpiredSignIn(error)).toBe(false)
  })

  it('reads each kind from the status and the network\'s words', () => {
    expect(classifySocialError({ status: 401, body: '' }).kind).toBe('expired')
    expect(classifySocialError({ status: 400, body: '{"error":"ExpiredToken","message":"Token has expired"}' }).kind).toBe('expired')
    expect(classifySocialError({ status: 429, body: '' }).kind).toBe('rate-limited')
    expect(classifySocialError({ status: 413, body: '' }).kind).toBe('media')
    expect(classifySocialError({ status: 403, body: '{"message":"Not enough permissions to post"}' }).kind).toBe('permission')
    expect(classifySocialError({ status: 503, body: '' }).kind).toBe('temporary')
    expect(classifySocialError({ status: 422, body: '{"error":"Validation failed: Text too long"}' }).kind).toBe('content')
  })

  it('tells a network fault from a driver\'s own refusal', () => {
    expect(classifySocialError(new TypeError('fetch failed')).kind).toBe('temporary')
    expect(classifySocialError(new Error('Bluesky posts must be 300 characters or fewer.')).kind).toBe('unknown')
  })
})

describe('Bluesky session errors', () => {
  it('counts a 400 only when Bluesky names the token', () => {
    expect(isBlueskySessionError(new BlueskyApiError('x', 400, '{"error":"ExpiredToken","message":"Token has expired"}'))).toBe(true)
    expect(isBlueskySessionError(new BlueskyApiError('x', 400, '{"error":"InvalidToken"}'))).toBe(true)
    expect(isBlueskySessionError(new BlueskyApiError('x', 401, ''))).toBe(true)
  })

  it('does not treat an invalid record as an expired session', () => {
    const invalid = new BlueskyApiError('x', 400, '{"error":"InvalidRequest","message":"Invalid app.bsky.feed.post record"}')
    expect(invalid.isAuthError).toBe(false)
    expect(isBlueskySessionError(invalid)).toBe(false)
    expect(isBlueskySessionError(new BlueskyApiError('x', 400, 'not json'))).toBe(false)
    expect(isBlueskySessionError(new Error('ExpiredToken'))).toBe(false)
  })
})
