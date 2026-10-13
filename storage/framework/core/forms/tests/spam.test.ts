import { describe, expect, test } from 'bun:test'
import { checkSubmissionSpam } from '../src/spam'

describe('checkSubmissionSpam', () => {
  test('a filled honeypot is a bot, an empty one is not', () => {
    expect(checkSubmissionSpam({ honeypot: 'https://spam.example' })).toBe('honeypot')
    expect(checkSubmissionSpam({ honeypot: '   ' })).toBeNull()
    expect(checkSubmissionSpam({ honeypot: 'x' }, { honeypot: false })).toBeNull()
  })

  test('a form sent faster than a person could fill it is too fast', () => {
    expect(checkSubmissionSpam({ renderedAtMs: 800 })).toBe('too_fast')
    expect(checkSubmissionSpam({ renderedAtMs: '1200' })).toBe('too_fast')
    expect(checkSubmissionSpam({ renderedAtMs: 4000 })).toBeNull()
    expect(checkSubmissionSpam({ renderedAtMs: 800 }, { minSubmitSeconds: 0 })).toBeNull()
  })

  test('no timing and nothing in the honeypot passes', () => {
    expect(checkSubmissionSpam({})).toBeNull()
    expect(checkSubmissionSpam({ renderedAtMs: 'soon' })).toBeNull()
  })
})
