/**
 * Adding to a framework model without forking it.
 *
 * An app model replaces the framework's copy outright — `findUserModel` wins
 * over `findCoreModel`, wholesale — so an app needing one extra column on a
 * commerce model had one option: copy the vendored file and own a
 * two-hundred-line divergence that stops tracking upstream at the next
 * release. The column that prompted this was the shop fulfilling an order, for
 * a business with two of them.
 *
 * The merge is asserted directly rather than through a booted model, because
 * what matters is which side wins for each kind of key.
 */

import { describe, expect, it } from 'bun:test'
import { schema } from '@stacksjs/validation'
import { mergeModelDefinition } from '../src/extend-model'

const base = {
  name: 'Order',
  table: 'orders',
  primaryKey: 'id',
  autoIncrement: true,
  traits: { useUuid: true, useTimestamps: true },
  belongsTo: ['Customer', 'Coupon'],
  hasMany: ['OrderItem'],
  dashboard: { highlight: true },
  attributes: {
    status: { order: 1, fillable: true, validation: { rule: schema.string() } },
    total: { order: 2, fillable: true, validation: { rule: schema.number() } },
  },
} as any

describe('mergeModelDefinition', () => {
  it('keeps everything the extension does not mention', () => {
    const merged = mergeModelDefinition(base, { attributes: { storeId: { fillable: true } } as any })

    expect(merged.table).toBe('orders')
    expect(merged.primaryKey).toBe('id')
    expect(Object.keys(merged.attributes!)).toContain('status')
    expect(Object.keys(merged.attributes!)).toContain('total')
  })

  it('adds new attributes', () => {
    const merged = mergeModelDefinition(base, { attributes: { storeId: { fillable: true } } as any })

    expect(Object.keys(merged.attributes!)).toEqual(['status', 'total', 'storeId'])
  })

  it('appends a new attribute after the last one rather than colliding on 0', () => {
    /*
     * `order` decides column and form position. An added attribute that omits
     * it would default to 0 and tie with the model's first column, so it is
     * placed at the end — which is where a reader expects a later addition.
     */
    const merged = mergeModelDefinition(base, { attributes: { storeId: { fillable: true } } as any })

    expect((merged.attributes as any).storeId.order).toBe(3)
  })

  it('honours an explicit order', () => {
    const merged = mergeModelDefinition(base, { attributes: { storeId: { order: 99, fillable: true } } as any })

    expect((merged.attributes as any).storeId.order).toBe(99)
  })

  it('lets an extension replace an attribute it names', () => {
    // How an app tightens a framework rule without restating the others.
    const merged = mergeModelDefinition(base, { attributes: { status: { order: 1, fillable: false } } as any })

    expect((merged.attributes as any).status.fillable).toBe(false)
    expect(Object.keys(merged.attributes!)).toHaveLength(2)
  })

  it('unions relations instead of replacing them', () => {
    // Replacing would silently drop the framework's own relations, and the
    // failure would surface as a missing join far from this file.
    const merged = mergeModelDefinition(base, { belongsTo: ['Store'] } as any)

    expect(merged.belongsTo).toEqual(['Customer', 'Coupon', 'Store'])
    expect(merged.hasMany).toEqual(['OrderItem'])
  })

  it('does not repeat a relation the base already declares', () => {
    const merged = mergeModelDefinition(base, { belongsTo: ['Customer', 'Store'] } as any)

    expect(merged.belongsTo).toEqual(['Customer', 'Coupon', 'Store'])
  })

  it('merges traits one level deep', () => {
    const merged = mergeModelDefinition(base, { traits: { useSearch: true } } as any)

    expect(merged.traits).toEqual({ useUuid: true, useTimestamps: true, useSearch: true } as any)
  })

  it('lets an extension override a single trait', () => {
    const merged = mergeModelDefinition(base, { traits: { useUuid: false } } as any)

    expect((merged.traits as any).useUuid).toBe(false)
    expect((merged.traits as any).useTimestamps).toBe(true)
  })

  it('leaves the base definition untouched', () => {
    // The base is a shared module-level object: mutating it would change the
    // framework's model for everything else in the process.
    mergeModelDefinition(base, { belongsTo: ['Store'], attributes: { x: { fillable: true } } as any })

    expect(base.belongsTo).toEqual(['Customer', 'Coupon'])
    expect(Object.keys(base.attributes)).toEqual(['status', 'total'])
  })
})
