import { describe, expect, test } from 'bun:test'
import { badgeClasses, badgeClassToggles, badgeDotClasses, badgeDotClassToggles, badgeShowsDot } from './dashboard-badge'

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

  test('the live toggles turn a grey first paint into exactly the bound variant', () => {
    // What the browser does with an object `:class`: add the true keys, remove
    // the false ones, leave every other class alone.
    const apply = (start: string, toggles: Record<string, boolean>) => {
      const list = new Set(start.split(' '))
      for (const [token, on] of Object.entries(toggles)) on ? list.add(token) : list.delete(token)
      return [...list].sort()
    }
    const sorted = (classes: string) => classes.split(' ').sort()

    expect(apply(badgeClasses('default'), badgeClassToggles('info'))).toEqual(sorted(badgeClasses('info')))
    expect(apply(badgeClasses('success', 'xs'), badgeClassToggles('danger', 'lg', 'default', 'true'))).toEqual(sorted(badgeClasses('danger', 'lg', 'default', true)))
    expect(apply(badgeDotClasses('default'), badgeDotClassToggles('warning'))).toEqual(sorted(badgeDotClasses('warning')))
  })
})
