import { describe, expect, it } from 'bun:test'
import type { DashboardModelOptions, DashboardModelRegionName, DashboardModelRegions } from '../src/dashboard'

/**
 * What a model's `dashboard` block may say about its list's filters and the
 * components it places on its pages, as the compiler holds a model to it.
 *
 * `bun test` runs this file, but Bun strips types: the `@ts-expect-error`
 * lines only mean something when tsc reads them, which
 * `bun run typecheck:type-tests` does (`*-types.test.ts`).
 */
describe('a model\'s dashboard filters and regions', () => {
  it('names the fields its list is narrowed by', () => {
    const named: DashboardModelOptions = { filters: ['status', 'team', 'createdAt'] }
    const none: DashboardModelOptions = { filters: [] }
    expect([named.filters?.length, none.filters?.length]).toEqual([3, 0])

    // @ts-expect-error a filter is named, not described: how it is asked for follows the field
    const described: DashboardModelOptions = { filters: [{ field: 'status', kind: 'choice' }] }
    expect(described.filters?.length).toBe(1)
  })

  it('places a component at each of the four places a page has', () => {
    const placed: DashboardModelOptions = {
      regions: { listTop: 'OrderTotals', listBottom: 'OrderExport', recordTop: 'OrderTimeline', recordBottom: 'OrderNotes' },
    }
    const some: DashboardModelRegions = { recordTop: 'OrderTimeline' }
    const places: DashboardModelRegionName[] = ['listTop', 'listBottom', 'recordTop', 'recordBottom']
    expect(Object.keys(placed.regions ?? {})).toEqual(places)
    expect(some.recordTop).toBe('OrderTimeline')

    // @ts-expect-error not a place a component can be put
    const elsewhere: DashboardModelOptions = { regions: { sidebar: 'Promo' } }
    // @ts-expect-error one component per place, by its name
    const several: DashboardModelOptions = { regions: { recordTop: ['OrderTimeline', 'OrderNotes'] } }
    expect([elsewhere.regions, several.regions].every(Boolean)).toBe(true)
  })
})
