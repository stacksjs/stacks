/**
 * The pure shop rules a browser bundles: a register's basket against stock,
 * a catalog's order and search, and when a digital product's parts open.
 */
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { addToBasket, basketCount, basketLines, basketTotal, canAdd, CENTS_FIELDS, groupsOf, setQuantity, shelfLeft, stockLabel } from '../src/register'
import { categoryRank, compareCatalog, isLowStock, matchesSearch, sizeOf } from '../src/catalog'
import { describeRollout, releaseSchedule, rolloutFromProduct, unlockAt, unlockedPrefix } from '../src/releases'

const DAY = 86_400_000
const bought = new Date('2026-09-24T10:00:00Z')
const daysAfter = (date: Date, days: number) => new Date(date.getTime() + days * DAY).toISOString()

describe('register', () => {
  const drink = { id: 1, name: 'Gatorade', price: 350, inventory: 2 }
  const tee = { id: 2, name: 'Tee', price: 2800 }

  it('rings up only what is on the shelf', () => {
    let basket = addToBasket([], drink)
    basket = addToBasket(basket, drink)
    expect(addToBasket(basket, drink)).toBe(basket)
    expect(shelfLeft(drink, basket)).toBe(0)
    expect(canAdd(drink, basket)).toBe(false)
    expect(shelfLeft(tee, basket)).toBeNull()
    expect(canAdd(tee, basket)).toBe(true)
  })

  it('sets, caps and removes lines, and totals them', () => {
    let basket = setQuantity([], tee, 3)
    basket = setQuantity(basket, drink, 9)
    expect(basket).toEqual([{ productId: 2, quantity: 3 }, { productId: 1, quantity: 2 }])
    expect(basketTotal(basket, [drink, tee])).toBe(2800 * 3 + 350 * 2)
    expect(basketCount(basket)).toBe(5)
    expect(setQuantity(basket, tee, 0)).toEqual([{ productId: 1, quantity: 2 }])
    expect(basketLines([{ productId: 9, quantity: 1 }], [drink])).toEqual([])
  })

  it('reads a catalog stored in cents', () => {
    const row = { id: 5, price_cents: 599, inventory_quantity: 4, low_stock_threshold: 4 }
    expect(basketTotal(addToBasket([], row, CENTS_FIELDS), [row], CENTS_FIELDS)).toBe(599)
    expect(stockLabel(row, [], CENTS_FIELDS)).toEqual({ text: '4 left', tone: 'low' })
  })

  it('labels stock: sold out, low at its own level or five, or how many', () => {
    expect(stockLabel(drink, addToBasket(addToBasket([], drink), drink))).toEqual({ text: 'Sold out', tone: 'out' })
    expect(stockLabel({ id: 3, inventory: 12 })).toEqual({ text: '12 left', tone: 'ok' })
    expect(stockLabel({ id: 3, inventory: 5 })).toEqual({ text: '5 left', tone: 'low' })
    expect(stockLabel(tee)).toBeNull()
  })

  it('lists groups in the order products come', () => {
    expect(groupsOf([{ c: 'Drinks' }, { c: 'Apparel' }, { c: 'Drinks' }], p => p.c)).toEqual(['Drinks', 'Apparel'])
  })
})

describe('catalog', () => {
  it('splits a size off a name', () => {
    expect(sizeOf('Logo Tee — M')).toEqual({ base: 'Logo Tee', size: 'M', rank: 3 })
    expect(sizeOf('Hoodie - xl')).toMatchObject({ base: 'Hoodie', size: 'XL' })
    expect(sizeOf('Gatorade 20 oz').rank).toBe(-1)
  })

  it('orders by category, name, and size', () => {
    const order = ['Drinks', 'Apparel']
    expect(categoryRank('Drinks', order)).toBe(0)
    expect(categoryRank('Toys', order)).toBe(2)
    expect(categoryRank(null, order)).toBe(3)
    const sorted = [
      { name: 'Tee — XL', category: 'Apparel' },
      { name: 'Tee — S', category: 'Apparel' },
      { name: 'Mug', category: 'Kitchen' },
      { name: 'Water', category: 'Drinks' },
      { name: 'Tee — M', category: 'Apparel' },
      { name: 'Sticker', category: null },
    ].sort(compareCatalog(order)).map(item => item.name)
    expect(sorted).toEqual(['Water', 'Tee — S', 'Tee — M', 'Tee — XL', 'Mug', 'Sticker'])
  })

  it('searches every word across fields', () => {
    expect(matchesSearch(['Gatorade Lemon-Lime', 'GAT-LL', 'Drinks'], 'gat lemon')).toBe(true)
    expect(matchesSearch(['Gatorade'], 'powerade')).toBe(false)
    expect(matchesSearch([null, undefined], '')).toBe(true)
  })

  it('says when stock is low', () => {
    expect(isLowStock(3, 3)).toBe(true)
    expect(isLowStock(6)).toBe(false)
    expect(isLowStock(null, 10)).toBe(false)
  })
})

describe('rollout', () => {
  it('releases everything at once on purchase', () => {
    const config = rolloutFromProduct({ release_mode: 'all_at_once' })
    const schedule = releaseSchedule(config, 3, bought, bought)
    expect(schedule.every(unit => unit.unlocked && unit.unlock_at === bought.toISOString())).toBe(true)
  })

  it('holds a pre-sale until launch', () => {
    const config = rolloutFromProduct({ release_mode: 'all_at_once', release_starts_at: '2026-10-01' })
    expect(unlockAt(config, 0, bought).toISOString()).toBe('2026-10-01T00:00:00.000Z')
    expect(releaseSchedule(config, 2, bought, bought).some(unit => unit.unlocked)).toBe(false)
  })

  it('drips one unit per interval after the initial batch, per buyer', () => {
    const config = rolloutFromProduct({ release_mode: 'drip', release_interval_days: 7, release_initial_count: 2 })
    const at = (index: number) => unlockAt(config, index, bought).toISOString()
    expect([at(0), at(1), at(2), at(3)]).toEqual([bought.toISOString(), bought.toISOString(), daysAfter(bought, 7), daysAfter(bought, 14)])
    const later = new Date('2026-12-01T00:00:00Z')
    expect(unlockAt(config, 2, later).toISOString()).toBe(daysAfter(later, 7))
  })

  it('lets a video override its drip slot', () => {
    const config = rolloutFromProduct({ release_mode: 'drip', release_interval_days: 7 })
    expect(unlockAt(config, 3, bought, { offsetDays: 1 }).toISOString()).toBe(daysAfter(bought, 1))
    expect(unlockAt(config, 3, bought, { offsetDays: 0 }).toISOString()).toBe(bought.toISOString())
  })

  it('schedules the same dates for everyone, and gives late buyers the back catalogue', () => {
    const config = rolloutFromProduct({ release_mode: 'scheduled', release_starts_at: '2026-09-01T00:00:00Z', release_interval_days: 7 })
    const early = releaseSchedule(config, 4, new Date('2026-08-01T00:00:00Z'), new Date('2026-09-10T00:00:00Z'))
    const late = releaseSchedule(config, 4, new Date('2026-09-10T00:00:00Z'), new Date('2026-09-10T00:00:00Z'))
    expect(early.map(unit => unit.unlock_at)).toEqual(late.map(unit => unit.unlock_at))
    expect(late.map(unit => unit.unlocked)).toEqual([true, true, false, false])
    expect(unlockAt(config, 3, bought, { releaseAt: '2026-12-25T00:00:00Z' }).toISOString()).toBe('2026-12-25T00:00:00.000Z')
  })

  it('counts only the leading run of open units', () => {
    expect(unlockedPrefix([{ index: 0, unlock_at: '', unlocked: true }, { index: 1, unlock_at: '', unlocked: false }, { index: 2, unlock_at: '', unlocked: true }])).toBe(1)
  })

  it('falls back to sane defaults for junk columns', () => {
    expect(rolloutFromProduct({ release_mode: 'weekly', release_interval_days: -3, release_initial_count: 0, release_starts_at: 'soon' }))
      .toEqual({ mode: 'all_at_once', intervalDays: 7, initialCount: 1, startsAt: null })
  })

  it('describes the rollout for the product page', () => {
    const now = new Date('2026-09-24T00:00:00Z')
    expect(describeRollout(rolloutFromProduct({ release_mode: 'drip' }), 6, 'week', now)).toBe('The first week unlocks on purchase, then one more every week.')
    expect(describeRollout(rolloutFromProduct({ release_mode: 'drip', release_interval_days: 3, release_initial_count: 2 }), 6, 'video', now)).toBe('The first 2 videos unlock on purchase, then one more every 3 days.')
    expect(describeRollout(rolloutFromProduct({ release_mode: 'all_at_once' }), 4, 'video', now)).toBe('All 4 videos available immediately.')
    expect(describeRollout(rolloutFromProduct({ release_mode: 'all_at_once', release_starts_at: '2026-10-05' }), 1, 'video', now)).toBe('Available from Oct 5, 2026.')
    expect(describeRollout(rolloutFromProduct({ release_mode: 'scheduled', release_starts_at: '2026-10-05' }), 4, 'video', now)).toBe('The first video releases on Oct 5, 2026, then one more every week, on the same dates for everyone.')
    expect(describeRollout(rolloutFromProduct({ release_mode: 'scheduled', release_starts_at: '2026-09-01' }), 4, 'week', now)).toBe('Releasing on a shared schedule since Sep 1, 2026, one more week every week. Join now and everything already out is yours.')
  })
})

describe('browser entrypoints', () => {
  it('import nothing, so a page can bundle them', () => {
    const transpiler = new Bun.Transpiler({ loader: 'ts' })
    for (const file of ['register.ts', 'catalog.ts', 'releases.ts', 'money.ts'])
      expect(transpiler.scanImports(readFileSync(join(import.meta.dir, '../src', file), 'utf8')).map(entry => entry.path), file).toEqual([])
  })
})
