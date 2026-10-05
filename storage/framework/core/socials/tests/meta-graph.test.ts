import { describe, expect, it } from 'bun:test'
import { META_GRAPH_VERSION } from '../src/meta-graph'

/**
 * The Facebook driver pinned `v18.0` in four places. That version expired on
 * 2026-01-26, and the Instagram driver - same host - defaulted to `v21.0`, so
 * two drivers against one API disagreed by three years and neither could be
 * configured.
 *
 * An expired pin does not announce itself: Meta serves the call from the oldest
 * version still supported rather than rejecting it, so the only symptom is that
 * the version in the URL stops being the version that answers. These assertions
 * are therefore structural, because there is no runtime error to catch.
 */
const META_DRIVERS = ['facebook', 'instagram'] as const

describe('Meta Graph API version', () => {
  it('is a well-formed Graph API version', () => {
    expect(META_GRAPH_VERSION).toMatch(/^v\d+\.\d+$/)
  })

  it.each(META_DRIVERS)('%s does not hardcode a version', async (driver) => {
    const source = await Bun.file(new URL(`../src/drivers/${driver}.ts`, import.meta.url)).text()

    // Matches a version used as a path segment, so prose and the doc comment's
    // `v21.0` example stay allowed. Booleans, so a failure names the driver
    // rather than printing the file.
    expect(/['"`/]v\d+\.\d+\//.test(source)).toBe(false)
    expect(source.includes('META_GRAPH_VERSION')).toBe(true)
  })

  it('is what the Facebook driver builds its URLs from', async () => {
    const source = await Bun.file(new URL('../src/drivers/facebook.ts', import.meta.url)).text()

    // Every Graph and dialog URL, including the login dialog on www.facebook.com.
    const versioned = [...source.matchAll(/\$\{this\.(?:apiUrl|baseUrl)\}\/\$\{this\.graphVersion\}/g)]

    expect(versioned).toHaveLength(4)
  })

  it('lets an application pin its own version', async () => {
    const source = await Bun.file(new URL('../src/drivers/facebook.ts', import.meta.url)).text()

    expect(source).toContain('config.services.facebook?.graphVersion')
  })

  /**
   * Instagram takes its version from a driver option, so the path-segment check
   * above cannot see a literal fallback. Pin the fallback itself: it used to be
   * its own `'v21.0'`, three years from Facebook's pin against the same host.
   */
  it('is what the Instagram driver falls back to', async () => {
    const source = await Bun.file(new URL('../src/drivers/instagram.ts', import.meta.url)).text()

    expect(source).toMatch(/options\.graphVersion \|\| META_GRAPH_VERSION/)
  })
})
