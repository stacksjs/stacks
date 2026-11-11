import { describe, expect, it } from 'bun:test'
import { describeLinkLifetime } from '../src/password/reset'

/**
 * The mail said "This link will expire in 60 minutes", which reads fine for a
 * reset. An invitation's setup link lasts days, and the same sentence came out
 * as "10080 minutes" (stacksjs/stacks#3252).
 */
describe('how long a link lasts, as a person would say it', () => {
  it('whole days from two days up', () => {
    expect(describeLinkLifetime(7 * 1440)).toBe('7 days')
    expect(describeLinkLifetime(2 * 1440)).toBe('2 days')
  })

  it('whole hours from two hours up', () => {
    expect(describeLinkLifetime(120)).toBe('2 hours')
    expect(describeLinkLifetime(24 * 60)).toBe('24 hours')
  })

  it('minutes below that, the default reset included', () => {
    expect(describeLinkLifetime(60)).toBe('60 minutes')
    expect(describeLinkLifetime(30)).toBe('30 minutes')
    expect(describeLinkLifetime(1)).toBe('1 minute')
    expect(describeLinkLifetime(0)).toBe('1 minute')
  })

  it('never rounds up to a longer unit than the link lasts', () => {
    expect(describeLinkLifetime(7 * 1440 - 1)).toBe('10079 minutes')
    expect(describeLinkLifetime(3 * 1440 + 60)).toBe('73 hours')
    expect(describeLinkLifetime(150)).toBe('150 minutes')
  })
})
