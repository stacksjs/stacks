/**
 * The marketing feature list, and the one thing about its route that fails
 * silently.
 *
 * resources/data/features.ts is read by three surfaces - the nav mega menu,
 * the home-page bento, and /features/:slug - so a bad entry here is a bad link
 * in all three at once, and none of them throw: a "pairs with" card pointing
 * at a slug that does not exist just renders and 404s when clicked.
 *
 * The route check is narrower and more specific. /features/:slug matches every
 * URL under /features, including the ones that name no feature, so the view
 * has to declare the status itself with `notFound()` (stx >= 0.2.219). Drop
 * that one call and the not-found body still renders, still looks right, and
 * goes out under a 200 - telling crawlers, caches and uptime checks that every
 * misspelling is a real page. Nothing about the page looks wrong when it
 * regresses, which is exactly why it is pinned here.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { featureBySlug, features, featuresInGroup, featureGroups } from '../../resources/data/features'

describe('the feature list', () => {
  test('is not empty and has unique, URL-safe slugs', () => {
    const slugs = features.map(feature => feature.slug)

    expect(slugs.length).toBeGreaterThan(0)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs)
      expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  })

  test('every "pairs with" slug names a feature that exists, and not itself', () => {
    for (const feature of features) {
      for (const related of feature.page.related) {
        expect(featureBySlug(related)).toBeDefined()
        // A card linking back to the page it is on is a dead end in the one
        // place the reader has certainly already been.
        expect(related).not.toBe(feature.slug)
      }
    }
  })

  test('every feature falls in a declared group, and no group is empty', () => {
    const groupIds = featureGroups.map(group => group.id)

    for (const feature of features)
      expect(groupIds).toContain(feature.group)

    // An empty column would render as a heading with nothing under it.
    for (const id of groupIds)
      expect(featuresInGroup(id).length).toBeGreaterThan(0)
  })

  test('the mega menu and the bento show every feature between them', () => {
    // Both render the whole list, so the menu cannot offer a section the page
    // below it lacks. Guarding the grouping is guarding the menu.
    expect(featureGroups.flatMap(group => featuresInGroup(group.id)).length).toBe(features.length)
  })
})

describe('the /features/:slug route', () => {
  const view = readFileSync(join(import.meta.dir, '../../resources/views/features/[slug].stx'), 'utf8')

  test('answers 404 for a slug that names no feature', () => {
    // Removing this line is invisible on the rendered page and turns every
    // unknown URL under /features into a soft 404.
    expect(view).toMatch(/if\s*\(!feature\)\s*\n?\s*notFound\(\)/)
  })
})
