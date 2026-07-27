import { describe, expect, it } from 'bun:test'
import { describeResponseError, describeThrownError } from '../src/composables/request-error'

describe('describeThrownError', () => {
  it('never shows a ReferenceError to the user', () => {
    // The bug this whole module exists for: a sign-in form rendered
    // "auth is not defined" as if it were guidance.
    const failure = describeThrownError(new ReferenceError('auth is not defined'))

    expect(failure.message).not.toContain('auth')
    expect(failure.message).not.toContain('not defined')
    expect(failure.unexpected).toBe(true)
    // The original survives for the log.
    expect((failure.cause as Error).message).toBe('auth is not defined')
  })

  it('never shows a property-access TypeError to the user', () => {
    const failure = describeThrownError(new TypeError('Cannot read properties of undefined (reading \'login\')'))

    expect(failure.message).not.toContain('undefined')
    expect(failure.unexpected).toBe(true)
  })

  it('tells the user when the request never left the machine', () => {
    // Browsers word this differently; all of them mean "offline".
    for (const message of ['Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed']) {
      const failure = describeThrownError(new TypeError(message))

      expect(failure.message.toLowerCase()).toContain('connection')
      expect(failure.unexpected).toBe(false)
    }
  })

  it('passes through a message our own code wrote deliberately', () => {
    const failure = describeThrownError(new Error('That trail is already saved.'))

    expect(failure.message).toBe('That trail is already saved.')
    expect(failure.unexpected).toBe(false)
  })

  it('does not trust a thrown non-Error as prose', () => {
    const failure = describeThrownError({ weird: true })

    expect(failure.message).toMatch(/went wrong/i)
    expect(failure.unexpected).toBe(true)
  })
})

describe('describeResponseError', () => {
  it('prefers a message the API wrote for a person', () => {
    const failure = describeResponseError(401, { success: false, message: 'Incorrect email or password' })

    expect(failure.message).toBe('Incorrect email or password')
    expect(failure.unexpected).toBe(false)
  })

  it('ignores a label that tells the user nothing', () => {
    // `Validation failed` is a log line, not advice.
    const failure = describeResponseError(422, {
      error: 'Validation failed',
      errors: { password: ['Password must be between 6 and 255 characters.'] },
    })

    expect(failure.message).toBe('Password must be between 6 and 255 characters.')
    expect(failure.fields).toEqual({ password: 'Password must be between 6 and 255 characters.' })
  })

  it('summarises rather than picking a winner when several fields failed', () => {
    const failure = describeResponseError(422, {
      error: 'Validation failed',
      errors: { email: ['Email is required.'], password: ['Too short.'] },
    })

    expect(failure.message).toMatch(/need fixing/i)
    expect(failure.fields).toEqual({ email: 'Email is required.', password: 'Too short.' })
  })

  it('explains a 403 as the expired session it almost always is', () => {
    const failure = describeResponseError(403, { error: 'Forbidden', message: 'CSRF token mismatch' })

    // "CSRF token mismatch" is true and useless; the actionable part is the reload.
    expect(failure.message.toLowerCase()).toContain('refresh')
  })

  it('marks a server fault as unexpected so the caller logs it', () => {
    const failure = describeResponseError(500, { error: 'Internal Server Error' })

    expect(failure.unexpected).toBe(true)
    expect(failure.message).toMatch(/our end/i)
  })

  it('asks the user to wait on a rate limit', () => {
    expect(describeResponseError(429).message).toMatch(/too many/i)
  })

  it('copes with an empty or unparseable body', () => {
    const failure = describeResponseError(401, null)

    expect(failure.message.length).toBeGreaterThan(0)
    expect(failure.fields).toBeUndefined()
  })

  it('drops empty field entries rather than rendering a blank line', () => {
    const failure = describeResponseError(422, { errors: { email: [], password: '' } })

    expect(failure.fields).toBeUndefined()
  })
})
