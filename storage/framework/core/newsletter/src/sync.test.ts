import { describe, expect, test } from 'bun:test'
import { looksLikeEmail, syncDecision } from './sync'

/**
 * Syncing an audience you already have onto a list.
 *
 * The decision is separated from the reading and writing precisely so it can
 * be pinned here, because the interesting cases are all refusals - and a
 * refusal that quietly stops working is how a school emails somebody who
 * asked, twice, not to be emailed.
 */

const clean = { duplicate: false, suppressed: false, listStatus: null }

describe('syncDecision', () => {
  test('adds an address that is not on the list', () => {
    expect(syncDecision('parent@school.test', clean)).toBe('add')
  })

  test('counts one already subscribed as existing, not a second add', () => {
    expect(syncDecision('parent@school.test', { ...clean, listStatus: 'subscribed' })).toBe('existing')
  })

  test('NEVER revives someone who unsubscribed', () => {
    // `subscribe()` deliberately flips this back on, because a person signing
    // up again is asking to return. A sync has no such request behind it: the
    // input is "everyone in my database", so the opt-out stands.
    expect(syncDecision('gone@school.test', { ...clean, listStatus: 'unsubscribed' })).toBe('skip-unsubscribed')
  })

  test('never adds a suppressed address', () => {
    // Bounced or complained. Sending again damages the sending domain for
    // every other school on the platform, not just this one.
    expect(syncDecision('bounced@school.test', { ...clean, suppressed: true })).toBe('skip-suppressed')
  })

  test('keeps the opt-out ahead of a fresh-looking record', () => {
    // Suppression and an unsubscribe can both apply; either one is a no.
    expect(syncDecision('gone@school.test', { duplicate: false, suppressed: true, listStatus: 'unsubscribed' }))
      .toBe('skip-suppressed')
  })

  test('counts a repeated address once', () => {
    // Two children, one parent address - a common shape in a school export.
    expect(syncDecision('parent@school.test', { ...clean, duplicate: true })).toBe('skip-duplicate')
  })

  test('reports something that is not an address rather than attempting it', () => {
    expect(syncDecision('', clean)).toBe('skip-invalid')
    expect(syncDecision('not-an-email', clean)).toBe('skip-invalid')
    expect(syncDecision('@school.test', clean)).toBe('skip-invalid')
    expect(syncDecision('parent@', clean)).toBe('skip-invalid')
  })

  test('an invalid address is rejected before anything else is considered', () => {
    expect(syncDecision('nonsense', { duplicate: true, suppressed: true, listStatus: 'unsubscribed' }))
      .toBe('skip-invalid')
  })
})

describe('looksLikeEmail', () => {
  test('accepts an ordinary address and rejects the near misses', () => {
    expect(looksLikeEmail('a@b.test')).toBe(true)
    expect(looksLikeEmail('')).toBe(false)
    expect(looksLikeEmail('a@')).toBe(false)
    expect(looksLikeEmail('@b.test')).toBe(false)
    expect(looksLikeEmail('ab.test')).toBe(false)
  })
})
