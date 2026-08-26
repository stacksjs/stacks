import { describe, expect, it } from 'bun:test'
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
    expect(isAlwaysAllowed('/_stx/crosswind.abc123.css')).toBe(true)
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
})
