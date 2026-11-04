import { describe, expect, test } from 'bun:test'
import { badgeClasses, badgeDotClasses, badgeShowsDot } from './dashboard-badge'

describe('dashboard badge classes', () => {
  test('a variant picks its colour', () => {
    expect(badgeClasses('info')).toContain('bg-cyan-500/15 text-cyan-600')
    expect(badgeClasses('success')).toContain('bg-green-500/15 text-green-600')
    expect(badgeClasses('danger', 'sm', 'full', true)).toContain('border-red-500/40 text-red-600')
    expect(badgeDotClasses('warning')).toContain('bg-orange-500')
  })

  test('an unknown or missing value falls back rather than printing undefined', () => {
    expect(badgeClasses('nope', 'huge')).toBe(badgeClasses())
    expect(badgeClasses(undefined)).toContain('bg-black/[0.06] text-neutral-600')
    expect(badgeDotClasses('nope')).toBe(badgeDotClasses())
    expect(badgeClasses()).not.toContain('undefined')
  })

  test('a flag that arrived as an attribute string reads as the attribute means', () => {
    expect(badgeClasses('info', 'sm', 'full', 'false')).toBe(badgeClasses('info'))
    expect(badgeClasses('info', 'sm', 'full', 'true')).toBe(badgeClasses('info', 'sm', 'full', true))
    expect(badgeShowsDot('true')).toBe(true)
    expect(badgeShowsDot('')).toBe(true)
    expect(badgeShowsDot('false')).toBe(false)
    expect(badgeShowsDot(undefined)).toBe(false)
  })
})
