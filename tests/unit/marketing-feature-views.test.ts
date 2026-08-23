/**
 * Every feature in the list has a view, and every view is in the list.
 *
 * /features/:slug used to be one dynamic route, `features/[slug].stx`, which
 * matched every URL under /features and so answered 200 for the ones that are
 * not features. An stx view cannot set its own status, so that soft 404 could
 * not be fixed from inside the template. It is eight concrete views now: an
 * unknown slug matches nothing, and stx answers an unmatched path with a real
 * 404 and the site's own error page.
 *
 * That trade buys correct statuses and opens one hole in exchange - eight
 * files that can drift from the list they render. Both directions of that
 * drift fail quietly in production:
 *
 *   a feature with no view   its mega-menu and bento links 404, while the
 *                            feature still advertises itself everywhere else
 *   a view with no feature   the page throws at render, because the partial
 *                            looks its slug up and gets undefined
 *
 * This test is the reason neither can ship. It is also the reason the eight
 * views can stay dumb: they carry a slug and nothing else, so there is nothing
 * else in them to get wrong.
 */
import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { features } from '../../resources/data/features'

const viewsDir = join(import.meta.dir, '../../resources/views/features')

/** The feature views, by slug. `index.stx` is the overview, not a feature. */
function featureViewSlugs(): string[] {
  return readdirSync(viewsDir)
    .filter(name => name.endsWith('.stx') && name !== 'index.stx')
    .map(name => name.replace(/\.stx$/, ''))
    .sort()
}

describe('feature views and the feature list', () => {
  test('there is exactly one view per feature, and no extras', () => {
    expect(featureViewSlugs()).toEqual(features.map(feature => feature.slug).sort())
  })

  test('each view declares the slug its filename promises', () => {
    for (const slug of featureViewSlugs()) {
      const source = readFileSync(join(viewsDir, `${slug}.stx`), 'utf8')

      // The whole contract between a view and the shared partial. A view that
      // sets someone else's slug renders someone else's page at this URL.
      expect(source).toContain(`const featureSlug = '${slug}'`)
      expect(source).toContain('@include(\'feature-page\')')
    }
  })
})

describe('the feature list itself', () => {
  test('slugs are unique and URL-safe', () => {
    const slugs = features.map(feature => feature.slug)

    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs)
      expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  })

  test('every related slug points at a feature that exists', () => {
    const slugs = new Set(features.map(feature => feature.slug))

    for (const feature of features) {
      for (const related of feature.page.related) {
        expect(slugs.has(related)).toBe(true)
        // A "pairs with" card linking back to the page it is on is a dead link
        // in the only place a reader is guaranteed to have already been.
        expect(related).not.toBe(feature.slug)
      }
    }
  })
})
