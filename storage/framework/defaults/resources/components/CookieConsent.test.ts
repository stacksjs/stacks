import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The banner's compliance contract (stacksjs/stacks#365).
 *
 * These are the properties a reviewer would check, and each is the kind of
 * thing a later styling pass removes without noticing: the decline button
 * becomes a text link, a checkbox picks up `checked`, the banner gains a
 * backdrop. Asserted against the source because they are facts about the
 * markup, not about the render.
 *
 * The decision logic itself is tested in
 * `core/composables/tests/use-cookie-consent.test.ts`.
 */

const source = readFileSync(join(import.meta.dir, 'CookieConsent.stx'), 'utf8')

describe('CookieConsent', () => {
  it('gives Decline the same treatment as Accept', () => {
    // A banner where refusing is a greyed-out link and accepting is the
    // primary button is the pattern regulators call out.
    const classesOf = (label: string): string => {
      const match = source.match(new RegExp(`<button[^>]*class="([^"]*)"[^>]*>\\s*${label}`, 's'))
        ?? source.match(new RegExp(`<button[^>]*class="([^"]*)"[^>]*>\\s*\\n\\s*${label}`, 's'))
      return match?.[1] ?? ''
    }

    const decline = classesOf('Decline')
    const accept = classesOf('Accept all')

    expect(decline).not.toBe('')
    expect(decline).toBe(accept)
  })

  it('preselects no optional category', () => {
    // Every optional checkbox binds to state that starts from what is
    // consented, which on a first visit is nothing. A literal `checked` on one
    // of them would silently opt the visitor in.
    const optional = [...source.matchAll(/<input type="checkbox"([^>]*)\/>/g)]
      .map(match => match[1]!)
      .filter(attrs => !attrs.includes('disabled'))

    expect(optional.length).toBe(3)
    for (const attrs of optional) {
      expect(attrs).toContain(':checked=')
      expect(attrs).not.toMatch(/\schecked[\s/]/)
    }
  })

  it('marks the necessary category as checked AND disabled', () => {
    // It cannot be declined, so showing it as a live choice would be a lie.
    expect(source).toMatch(/<input type="checkbox" checked disabled/)
  })

  it('does not trap the visitor in a modal', () => {
    // Consent obtained by making the site unusable is not freely given, so
    // this is a region rather than a modal dialog with a backdrop.
    expect(source).toContain('role="region"')
    expect(source).not.toContain('role="dialog"')
    expect(source).not.toContain('aria-modal')
  })

  it('labels the region and the category group for screen readers', () => {
    expect(source).toContain('aria-label="Cookie consent"')
    expect(source).toContain('<legend class="sr-only">')
  })

  it('links to the policy', () => {
    expect(source).toContain(':href="policyUrl"')
  })

  it('renders nothing once a decision exists', () => {
    // The whole banner is behind `needsDecision`; a visitor who has decided
    // must not see it again on every page.
    expect(source).toMatch(/@if\(needsDecision\)/)
  })
})
