import { describe, expect, test } from 'bun:test'
import { buttonVariantClasses, buttonVariantToggles } from './dashboard-button'

// What the browser does with an object `:class`: add the true keys, remove the
// false ones, leave every other class alone.
function apply(start: string, toggles: Record<string, boolean>): string[] {
  const list = new Set(start.split(/\s+/).filter(Boolean))
  for (const [token, on] of Object.entries(toggles)) on ? list.add(token) : list.delete(token)
  return [...list].sort()
}

const sorted = (classes: string) => classes.split(/\s+/).filter(Boolean).sort()

describe('dashboard button variant toggles', () => {
  test('a bound variant replaces the first paint\'s colour', () => {
    const base = 'inline-flex items-center h-8'
    const painted = `${base} ${buttonVariantClasses.primary}`
    expect(apply(painted, buttonVariantToggles('danger'))).toEqual(sorted(`${base} ${buttonVariantClasses.danger}`))
  })

  test('the caller\'s own classes survive even when a variant uses them too', () => {
    const caller = 'border shadow-sm w-full'
    const painted = `${caller} ${buttonVariantClasses.secondary}`
    const result = apply(painted, buttonVariantToggles('primary', caller))
    for (const token of caller.split(' ')) expect(result).toContain(token)
    expect(result).not.toContain('bg-white/80')
  })

  test('bare keeps nothing of a variant and an unknown one falls back to primary', () => {
    expect(apply(buttonVariantClasses.success, buttonVariantToggles('bare'))).toEqual([])
    expect(apply('', buttonVariantToggles('nope'))).toEqual(sorted(buttonVariantClasses.primary))
  })
})
