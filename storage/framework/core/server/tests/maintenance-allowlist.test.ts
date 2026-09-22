import { afterEach, describe, expect, it } from 'bun:test'
import { isAlwaysAllowed } from '../src/maintenance'

/**
 * What still answers while a site is in coming-soon or maintenance mode.
 *
 * The holding page has to render, which means the things it links to have to
 * load. This shipped once with a stylesheet at the document root, which
 * matched no prefix: the page answered 200, the CSS answered a redirect, and
 * the site served an unstyled page in a serif on a live domain. No status-code
 * check caught it, because the HTML was fine.
 */

describe('isAlwaysAllowed', () => {
  it('lets the holding page and its subscribe endpoint through', () => {
    expect(isAlwaysAllowed('/coming-soon')).toBe(true)
    expect(isAlwaysAllowed('/api/email/subscribe')).toBe(true)
  })

  it('lets the tidy asset prefixes through', () => {
    expect(isAlwaysAllowed('/css/app.css')).toBe(true)
    expect(isAlwaysAllowed('/images/logo.svg')).toBe(true)
    expect(isAlwaysAllowed('/fonts/inter.woff2')).toBe(true)
    expect(isAlwaysAllowed('/_stx/css.abc123.css')).toBe(true)
  })

  it('lets a stylesheet through wherever it is served from', () => {
    // The real regression: not every project keeps its CSS under /css/.
    expect(isAlwaysAllowed('/tokens.css')).toBe(true)
    expect(isAlwaysAllowed('/build/app.a1b2c3.css')).toBe(true)
    expect(isAlwaysAllowed('/static/bundle.js')).toBe(true)
    expect(isAlwaysAllowed('/brand/mark.svg')).toBe(true)
  })

  it('is case-insensitive about the extension', () => {
    expect(isAlwaysAllowed('/Tokens.CSS')).toBe(true)
  })

  it('still withholds the pages the mode exists to withhold', () => {
    expect(isAlwaysAllowed('/')).toBe(false)
    expect(isAlwaysAllowed('/events')).toBe(false)
    expect(isAlwaysAllowed('/api/campushq/events')).toBe(false)

    // Documents and pages are content, not assets, whatever their extension.
    expect(isAlwaysAllowed('/about.html')).toBe(false)
    expect(isAlwaysAllowed('/prospectus.pdf')).toBe(false)
  })

  describe('APP_MAINTENANCE_ALLOW', () => {
    // An application knows about surfaces the framework cannot: a public share
    // link, a status endpoint, a webhook a provider retries into. Without a way
    // to declare them, the only lever is lifting the curtain for everything.
    const original = process.env.APP_MAINTENANCE_ALLOW

    afterEach(() => {
      if (original === undefined)
        delete process.env.APP_MAINTENANCE_ALLOW
      else
        process.env.APP_MAINTENANCE_ALLOW = original
    })

    it('lets a declared wildcard prefix through', () => {
      process.env.APP_MAINTENANCE_ALLOW = '/share/*'
      expect(isAlwaysAllowed('/share/demo')).toBe(true)
      expect(isAlwaysAllowed('/share/abc/def')).toBe(true)
    })

    it('accepts a trailing slash as the same thing', () => {
      process.env.APP_MAINTENANCE_ALLOW = '/share/'
      expect(isAlwaysAllowed('/share/demo')).toBe(true)
    })

    it('matches an exact path exactly, and nothing below it', () => {
      process.env.APP_MAINTENANCE_ALLOW = '/healthz'
      expect(isAlwaysAllowed('/healthz')).toBe(true)
      expect(isAlwaysAllowed('/healthz/deep')).toBe(false)
    })

    it('takes several entries, and ignores the spaces between them', () => {
      process.env.APP_MAINTENANCE_ALLOW = '/share/*, /api/share/* ,/healthz'
      expect(isAlwaysAllowed('/share/demo')).toBe(true)
      expect(isAlwaysAllowed('/api/share/demo')).toBe(true)
      expect(isAlwaysAllowed('/healthz')).toBe(true)
    })

    it('withholds everything else, which is the point of the mode', () => {
      process.env.APP_MAINTENANCE_ALLOW = '/share/*'
      expect(isAlwaysAllowed('/login')).toBe(false)
      expect(isAlwaysAllowed('/dashboard')).toBe(false)
      expect(isAlwaysAllowed('/')).toBe(false)
    })

    it('is read per call, so a mode flipped in a live process sees it', () => {
      delete process.env.APP_MAINTENANCE_ALLOW
      expect(isAlwaysAllowed('/share/demo')).toBe(false)
      process.env.APP_MAINTENANCE_ALLOW = '/share/*'
      expect(isAlwaysAllowed('/share/demo')).toBe(true)
    })
  })

})
