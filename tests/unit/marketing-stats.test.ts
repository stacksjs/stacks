/**
 * The home page's numbers, and the bento's arithmetic.
 *
 * resources/data/stats.ts holds the "100+ models" style figures. Each is a
 * floor checked here against the real tree, so the page can never claim more
 * than ships: it said "140-plus skills" while 115 existed, and nothing about
 * the page looked wrong.
 *
 * The bento places each feature by `bento.cols` out of 12, in list order. A
 * run that does not sum to 12 leaves a hole at the end of a row on desktop,
 * which renders without complaint, so the rows are pinned too.
 */
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { features } from '../../resources/data/features'
import { stats } from '../../resources/data/stats'

const root = join(import.meta.dir, '../..')

function count(dir: string, match: string): number {
  return readdirSync(dir, { withFileTypes: true }).reduce((total, entry) => {
    if (entry.isDirectory())
      return total + count(join(dir, entry.name), match)
    const hit = match.startsWith('.') ? entry.name.endsWith(match) && !entry.name.endsWith(`.test${match}`) : entry.name === match
    return total + (hit ? 1 : 0)
  }, 0)
}

describe('the home page stats', () => {
  for (const stat of stats) {
    test(`"${stat.value} ${stat.label}" is not more than ships`, () => {
      expect(count(join(root, stat.countIn), stat.match)).toBeGreaterThanOrEqual(stat.floor)
    })

    test(`"${stat.value}" prints its own floor`, () => {
      // The label and the checked number are separate fields; this keeps a
      // raised floor from leaving the old figure on the page, or the reverse.
      expect(stat.value).toBe(`${stat.floor}+`)
    })
  }
})

describe('the bento layout', () => {
  test('every row of cells fills exactly 12 columns', () => {
    const rows: string[][] = []
    let row: string[] = []
    let used = 0

    for (const feature of features) {
      used += feature.bento.cols
      row.push(`${feature.slug} (${feature.bento.cols})`)
      // Overshooting 12 means the cell wraps and leaves a hole behind it.
      expect(used, `row: ${row.join(', ')}`).toBeLessThanOrEqual(12)
      if (used === 12) {
        rows.push(row)
        row = []
        used = 0
      }
    }

    expect(row, `unfinished last row: ${row.join(', ')}`).toEqual([])
    expect(rows.length).toBeGreaterThan(0)
  })

  test('each visual names data its feature actually has', () => {
    for (const feature of features) {
      if (feature.bento.visual === 'code')
        expect(feature.page.code.code.length).toBeGreaterThan(0)
      if (feature.bento.visual === 'capabilities')
        expect(feature.page.capabilities.length).toBeGreaterThanOrEqual(3)
    }
  })
})
