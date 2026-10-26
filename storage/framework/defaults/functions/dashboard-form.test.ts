import { describe, expect, it } from 'bun:test'
import { formErrorMessages, slugify } from './dashboard-form'

/**
 * stacksjs/stacks#2918 — this was duplicated across fourteen dialogs. The
 * cases below are the formatting those copies encoded; they are pinned here
 * so the single definition cannot quietly change what a user reads.
 */
describe('formErrorMessages', () => {
  it('turns a snake_case field into a sentence-case label', () => {
    expect(formErrorMessages({ first_name: 'is required' })).toEqual(['First name: is required'])
  })

  it('splits camelCase, but not to the same result', () => {
    // Pinning a wart, not endorsing it. The split inserts a space without
    // lowering the second word, so `firstName` and `first_name` do not read
    // alike. Changing that is a product call; this test exists so the change
    // is deliberate when it happens.
    expect(formErrorMessages({ firstName: 'is required' })).toEqual(['First Name: is required'])
  })

  it('splits every word, not just the first', () => {
    expect(formErrorMessages({ shipping_zone_name: 'is taken' })).toEqual(['Shipping zone name: is taken'])
    expect(formErrorMessages({ taxRateCode: 'is invalid' })).toEqual(['Tax Rate Code: is invalid'])
  })

  it('keeps one line per field, in the order given', () => {
    expect(formErrorMessages({ name: 'is required', code: 'is taken' })).toEqual([
      'Name: is required',
      'Code: is taken',
    ])
  })

  it('has nothing to say about an empty map', () => {
    expect(formErrorMessages({})).toEqual([])
  })

  it('leaves an already-capitalised single word alone', () => {
    expect(formErrorMessages({ Name: 'is required' })).toEqual(['Name: is required'])
  })
})

describe('slugify', () => {
  it('turns a name into the slug a dialog proposes', () => {
    expect(slugify('Trail Runner')).toBe('trail-runner')
    expect(slugify('  Café & Bar  ')).toBe('cafe-bar')
    expect(slugify('50% off: Summer!')).toBe('50-off-summer')
    expect(slugify('---')).toBe('')
  })
})
