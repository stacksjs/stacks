import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { subscribeOutcomeFrom } from '../../resources/data/blog'
import { isSubscribeOutcome, subscribeMessages, subscribeOutcome } from '../../resources/data/signup-messages'

const root = join(import.meta.dir, '../..')

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

describe('the ?subscribe= a page comes back with', () => {
  test('names an outcome or nothing', () => {
    expect(subscribeOutcomeFrom({ subscribe: 'busy' })).toBe('busy')
    expect(subscribeOutcomeFrom({ subscribe: 'toString' })).toBe('')
    expect(subscribeOutcomeFrom({})).toBe('')
    expect(subscribeOutcomeFrom(undefined)).toBe('')
    expect(isSubscribeOutcome('constructor')).toBe(false)
  })

  test('every outcome has something to say', () => {
    for (const notice of Object.values(subscribeMessages))
      expect(notice.text.length).toBeGreaterThan(20)
  })
})

describe('SignupForm', () => {
  const source = readFileSync(join(root, 'resources/components/SignupForm.stx'), 'utf8')

  test('is bound with stx, not by querying the document', () => {
    expect(source).toContain('@submit.prevent="submit()"')
    expect(source).toContain('x-model.trim="email"')
    expect(source).not.toMatch(/document\.|window\.|querySelector/)
  })

  test('still posts as a plain form without JavaScript', () => {
    expect(source).toContain('action="/api/email/subscribe"')
    expect(source).toContain('method="POST"')
    expect(source).toContain('name="return"')
  })
})
