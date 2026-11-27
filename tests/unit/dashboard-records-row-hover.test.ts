import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * A hovered row on a model's records page, and its sticky Actions cell.
 *
 * The cell turned nearly white on hover in dark mode. It asked for
 * `group-hover:bg-neutral-50 dark:group-hover:bg-white/5`, and the stacked
 * `dark:group-hover:` lost its `.dark` condition in ts-css, so the light
 * colour won. Its dark colour was also see-through: a sticky cell sits over
 * the columns scrolling under it, and 5% white let them show.
 *
 * Now the row names its hover colour once, opaque in both themes, and the row
 * and the cell both paint with it, each through a single variant.
 */
const source = readFileSync(resolve('storage/framework/defaults/resources/components/Dashboard/Models/ModelRecordsDashboard.stx'), 'utf8')
const row = source.match(/<tr :for="row in rows\(\)" class="([^"]*)"/)![1]!.split(/\s+/)
const sticky = source.match(/<td class="([^"]*\bsticky\b[^"]*)">\s*<ModelRecordActions/)![1]!.split(/\s+/)

describe('a hovered records row', () => {
  test('the row names one opaque hover colour for each theme', () => {
    expect(row).toContain('[--row-hover:#fafafa]')
    // 5% white over the card's neutral-900 (#171717), made opaque.
    expect(row).toContain('dark:[--row-hover:#232323]')
    expect(row).toContain('hover:bg-[var(--row-hover)]')
    expect(row).toContain('group')
  })

  test('the sticky Actions cell paints with the row\'s colour, through one variant', () => {
    expect(sticky).toContain('group-hover:bg-[var(--row-hover)]')
    expect(sticky).toEqual(expect.arrayContaining(['bg-white', 'dark:bg-neutral-900']))
    // No stacked theme-and-group variant, and nothing see-through.
    expect(sticky.filter(name => /^dark:group-/.test(name))).toEqual([])
    expect(sticky.filter(name => /^(?:[a-z-]+:)*bg-[a-z]+(?:-\d+)?\/\d+$/.test(name))).toEqual([])
  })
})
