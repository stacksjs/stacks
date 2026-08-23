/**
 * The comparison list, its route, and the promise the pages make.
 *
 * resources/data/comparisons.ts backs the Compare mega menu, the matrix on
 * /compare, and the eighteen pages under it. The link checks here are the
 * same ones the feature and use-case lists get, because the same silent
 * failure applies: a related slug that names nothing renders fine and 404s
 * when clicked.
 *
 * The last two tests are different in kind. These pages claim to say where
 * the other framework is the better choice before they say where Stacks is,
 * and the template renders `theirStrengths` and `verdict.pickThem` whether
 * or not anyone wrote them. An entry that quietly ships an empty
 * theirStrengths array, or a pickThem line shorter than its pickStacks
 * counterpart, turns a comparison into an advertisement without anything
 * looking broken. That is a policy worth pinning in a test rather than in a
 * comment nobody reads.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import {
  comparisonBySlug,
  comparisonGroups,
  comparisons,
  comparisonsInGroup,
  matrixDimensions,
  matrixLegend,
  stacksMatrix,
} from '../../resources/data/comparisons'

const LEVELS = matrixLegend.map(entry => entry.level)

describe('the comparison list', () => {
  test('is not empty and has unique, URL-safe slugs', () => {
    const slugs = comparisons.map(comparison => comparison.slug)

    expect(slugs.length).toBeGreaterThan(0)
    expect(new Set(slugs).size).toBe(slugs.length)
    for (const slug of slugs)
      expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  })

  test('every related slug names a comparison that exists, and not itself', () => {
    for (const comparison of comparisons) {
      for (const related of comparison.page.related) {
        expect(comparisonBySlug(related)).toBeDefined()
        expect(related).not.toBe(comparison.slug)
      }
    }
  })

  test('every comparison falls in a declared group, and no group is empty', () => {
    const groupIds = comparisonGroups.map(group => group.id)

    for (const comparison of comparisons)
      expect(groupIds).toContain(comparison.group)

    for (const id of groupIds)
      expect(comparisonsInGroup(id).length).toBeGreaterThan(0)
  })

  test('every matrix covers every dimension with a level the legend explains', () => {
    // The table renders one cell per dimension per row. A missing key is an
    // empty cell that reads as "no answer" rather than as a gap in the data,
    // and an unknown level renders a badge with no styling.
    for (const matrix of [stacksMatrix, ...comparisons.map(comparison => comparison.matrix)]) {
      for (const dimension of matrixDimensions) {
        expect(matrix[dimension.id]).toBeDefined()
        expect(LEVELS).toContain(matrix[dimension.id])
      }
    }
  })

  test('kinds stay short enough for the compact menu row', () => {
    // The Compare menu shows `kind` as its second line and clamps it. These
    // are labels, not sentences.
    for (const comparison of comparisons)
      expect(comparison.kind.length).toBeLessThanOrEqual(34)
  })
})

describe('the fairness policy these pages promise', () => {
  test('every comparison says where the other framework wins', () => {
    for (const comparison of comparisons) {
      expect(comparison.page.theirStrengths.length).toBeGreaterThanOrEqual(3)

      for (const point of comparison.page.theirStrengths) {
        expect(point.title.trim().length).toBeGreaterThan(0)
        expect(point.text.trim().length).toBeGreaterThan(20)
      }
    }
  })

  test('the two verdicts get comparable room', () => {
    // The panels sit side by side at the same width, so a one-line "pick
    // them" beside a paragraph of "pick us" is visible as a thumb on the
    // scale. Half the length of the other is the floor.
    for (const comparison of comparisons) {
      const { pickThem, pickStacks } = comparison.page.verdict

      expect(pickThem.trim().length).toBeGreaterThan(60)
      expect(pickStacks.trim().length).toBeGreaterThan(60)
      expect(pickThem.length).toBeGreaterThan(pickStacks.length / 2)
    }
  })

  test('every page has the rows and sections the template renders', () => {
    for (const comparison of comparisons) {
      expect(comparison.page.rows.length).toBeGreaterThanOrEqual(6)
      expect(comparison.page.ourStrengths.length).toBeGreaterThanOrEqual(3)
      expect(comparison.page.migration.length).toBeGreaterThanOrEqual(2)
      expect(comparison.page.summary.trim().length).toBeGreaterThan(120)

      for (const row of comparison.page.rows) {
        expect(row.stacks.trim().length).toBeGreaterThan(0)
        expect(row.other.trim().length).toBeGreaterThan(0)
      }
    }
  })
})

describe('the /compare/:slug route', () => {
  const view = readFileSync(join(import.meta.dir, '../../resources/views/compare/[slug].stx'), 'utf8')

  test('answers 404 for a slug that names no comparison', () => {
    expect(view).toMatch(/if\s*\(!comparison\)\s*\n?\s*notFound\(\)/)
  })
})
