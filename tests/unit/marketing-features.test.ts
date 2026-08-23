/**
 * The feature list, and the one view that renders all of it.
 *
 * /features/:slug is a single dynamic route again. It briefly was not: the
 * route matches every URL under /features, so it answered 200 for the ones
 * that name no feature, and an stx view had no way to say otherwise from
 * inside the template. The workaround was eight concrete views — an unknown
 * slug then matched no route at all — which bought the right status and opened
 * a drift hole in exchange, eight files that could fall out of step with the
 * list they render.
 *
 * stx 0.2.219 removed the reason for the trade: `notFound()` in `<script
 * server>` answers 404 for the render that calls it. One view, no drift, and
 * the checks below are the ones that outlived the arrangement.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { features } from '../../resources/data/features'

const slugView = readFileSync(join(import.meta.dir, '../../resources/views/features/[slug].stx'), 'utf8')

describe('the feature page', () => {
  test('answers 404 for a slug that names no feature', () => {
    // The soft 404 this replaces was invisible in the browser — the page said
    // "no feature by that name" either way. Only the status told them apart,
    // and it said the URL was fine.
    expect(slugView).toContain('if (!feature)\n  notFound()')
  })

  test('still renders a real feature from the shared list', () => {
    // Same data as the mega menu and the home page bento, so the three
    // surfaces cannot disagree about what the product has.
    expect(slugView).toContain(`from '../../data/features'`)
    expect(slugView).toContain('const feature = featureBySlug(requestedSlug)')
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
