/**
 * The use-case list, and the one thing about its route that fails silently.
 *
 * resources/data/use-cases.ts is read by three surfaces - the Use cases mega
 * menu, the /use-cases overview, and /use-cases/:slug - so a bad entry here
 * is a bad link in all three at once, and none of them throw. A "next door
 * to this" card pointing at a slug that does not exist just renders and 404s
 * when clicked, and a `stack` slug that no longer names a feature renders a
 * chip that leads nowhere.
 *
 * The route check is the same one /features/:slug needs: the route matches
 * every URL under /use-cases, including the ones that name nothing, so the
 * view has to declare the status itself with notFound(). Drop that call and
 * the not-found body still renders, still looks right, and goes out under a
 * 200, telling crawlers, caches, and uptime checks that every misspelling is
 * a real page.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { features } from '../../resources/data/features'
import { useCaseBySlug, useCaseGroups, useCases, useCasesInGroup } from '../../resources/data/use-cases'

describe('the use-case list', () => {
  test('is not empty and has unique, URL-safe slugs', () => {
    const slugs = useCases.map(useCase => useCase.slug)

    expect(slugs.length).toBeGreaterThan(0)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs)
      expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  })

  test('every "next door to this" slug names a use case that exists, and not itself', () => {
    for (const useCase of useCases) {
      for (const related of useCase.page.related) {
        expect(useCaseBySlug(related)).toBeDefined()
        // A card linking back to the page it is on is a dead end in the one
        // place the reader has certainly already been.
        expect(related).not.toBe(useCase.slug)
      }
    }
  })

  test('every stack slug names a feature that ships', () => {
    // This is the cross-list check. Renaming a feature slug in features.ts
    // silently turns these chips into 404s, on up to eighteen pages at once.
    const featureSlugs = new Set(features.map(feature => feature.slug))

    for (const useCase of useCases) {
      expect(useCase.page.stack.length).toBeGreaterThan(0)
      for (const slug of useCase.page.stack)
        expect(featureSlugs).toContain(slug)

      // The strip renders in order; the same feature twice is a duplicate chip.
      expect(new Set(useCase.page.stack).size).toBe(useCase.page.stack.length)
    }
  })

  test('every use case falls in a declared group, and no group is empty', () => {
    const groupIds = useCaseGroups.map(group => group.id)

    for (const useCase of useCases)
      expect(groupIds).toContain(useCase.group)

    // An empty column would render as a heading with nothing under it.
    for (const id of groupIds)
      expect(useCasesInGroup(id).length).toBeGreaterThan(0)
  })

  test('the menu and the overview show every use case between them', () => {
    expect(useCaseGroups.flatMap(group => useCasesInGroup(group.id)).length).toBe(useCases.length)
  })

  test('blurbs stay short enough for the menu row that shows them', () => {
    // Two clamped lines in the compact panel is about 72 characters. Longer
    // than that and the row ends in an ellipsis, which is what this list
    // looked like before the blurbs were rewritten.
    for (const useCase of useCases)
      expect(useCase.blurb.length).toBeLessThanOrEqual(72)
  })

  test('every page has the content the template renders', () => {
    for (const useCase of useCases) {
      expect(useCase.page.challenges.length).toBeGreaterThan(0)
      expect(useCase.page.capabilities.length).toBeGreaterThan(0)
      expect(useCase.page.commands.length).toBeGreaterThan(0)
      expect(useCase.page.code.code.trim().length).toBeGreaterThan(0)
    }
  })
})

describe('the /use-cases/:slug route', () => {
  const view = readFileSync(join(import.meta.dir, '../../resources/views/use-cases/[slug].stx'), 'utf8')

  test('answers 404 for a slug that names no use case', () => {
    expect(view).toMatch(/if\s*\(!useCase\)\s*\n?\s*notFound\(\)/)
  })
})
