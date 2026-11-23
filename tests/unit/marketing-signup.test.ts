import { describe, expect, test } from 'bun:test'
import { subscribeMessages, subscribeNotice } from '../../resources/data/blog'
import { signupScript, subscribeOutcome } from '../../resources/data/signup'

describe('subscribeOutcome', () => {
  test('reads each answer /api/email/subscribe gives a script', () => {
    expect(subscribeOutcome(200, { success: true, subscriber: {} })).toBe('subscribed')
    expect(subscribeOutcome(200, { success: true, message: 'Subscribed' })).toBe('subscribed')
    expect(subscribeOutcome(200, { success: true, message: 'Already subscribed' })).toBe('already')
    expect(subscribeOutcome(200, { success: false, message: 'A valid email is required' })).toBe('invalid')
    expect(subscribeOutcome(429, { error: 'Too many requests' })).toBe('busy')
    expect(subscribeOutcome(500, null)).toBe('error')
    expect(subscribeOutcome(502, 'Bad Gateway')).toBe('error')
  })
})

describe('signupScript', () => {
  const body = signupScript.slice('<script>'.length, -'</script>'.length)

  test('is one script that parses on its own', () => {
    expect(signupScript.startsWith('<script>')).toBe(true)
    expect(body).not.toContain('</script')
    expect(() => new Function(body)).not.toThrow()
  })

  test('carries the same messages the server renders', () => {
    for (const notice of Object.values(subscribeMessages))
      expect(body).toContain(JSON.stringify(notice.text))
  })

  test('the server reads the same table for a plain form post', () => {
    expect(subscribeNotice({ subscribe: 'busy' })).toEqual(subscribeMessages.busy)
    expect(subscribeNotice({ subscribe: 'toString' })).toBeNull()
    expect(subscribeNotice({})).toBeNull()
  })
})
