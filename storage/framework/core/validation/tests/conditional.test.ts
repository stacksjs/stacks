import { describe, expect, test } from 'bun:test'
import { applyConditionals, schema, shouldApplyConditional, withConditionals } from '../src'
import { v as tsV } from '@stacksjs/ts-validation'

// stacksjs/stacks#1890 — conditional validation (.when() / .sometimes()).

describe('schema.string().when(...)', () => {
  test('cross-field conditional: required when sibling field matches', () => {
    const s = schema.object({
      payment_method: schema.enum(['card', 'bank']),
      card_token: schema.string().when('payment_method', 'card', s => s.required()),
      bank_account: schema.string().when('payment_method', 'bank', s => s.required()),
    })

    // card flow: card_token is required, bank_account is not
    const cardOk = s.validate({ payment_method: 'card', card_token: 'tok_visa' })
    expect(cardOk.valid).toBe(true)

    const cardMissingToken = s.validate({ payment_method: 'card' })
    expect(cardMissingToken.valid).toBe(false)

    // bank flow: bank_account is required, card_token is not
    const bankOk = s.validate({ payment_method: 'bank', bank_account: 'acct_123' })
    expect(bankOk.valid).toBe(true)

    const bankMissingAccount = s.validate({ payment_method: 'bank' })
    expect(bankMissingAccount.valid).toBe(false)
  })

  test('predicate match: refinement only fires when predicate returns true', () => {
    const s = schema.object({
      country: schema.string(),
      // EU customers need a VAT id
      vat: schema.string().when('country', (c) => {
        return typeof c === 'string' && ['DE', 'FR', 'IT', 'ES'].includes(c)
      }, s => s.required()),
    })

    const de = s.validate({ country: 'DE' })
    expect(de.valid).toBe(false) // VAT missing

    const us = s.validate({ country: 'US' })
    expect(us.valid).toBe(true) // VAT not required outside EU

    const deOk = s.validate({ country: 'DE', vat: 'DE123456789' })
    expect(deOk.valid).toBe(true)
  })

  test('multiple .when() clauses stack', () => {
    const s = schema.object({
      tier: schema.string(),
      addon: schema.string(),
      premium_feature: schema.string()
        .when('tier', 'pro', s => s.required())
        .when('addon', 'analytics', s => s.required()),
    })

    // pro tier + no addon → required by first clause
    const pro = s.validate({ tier: 'pro', addon: 'none' })
    expect(pro.valid).toBe(false)

    // free tier + analytics addon → required by second clause
    const free = s.validate({ tier: 'free', addon: 'analytics' })
    expect(free.valid).toBe(false)

    // free tier + no addon → not required
    const noop = s.validate({ tier: 'free', addon: 'none' })
    expect(noop.valid).toBe(true)
  })
})

describe('schema.string().sometimes()', () => {
  test('skips rules when the key is absent from input', () => {
    const s = schema.object({
      username: schema.string().sometimes().min(3),
    })

    // present + valid → passes
    expect(s.validate({ username: 'glenn' }).valid).toBe(true)

    // absent → no min enforcement, passes
    expect(s.validate({}).valid).toBe(true)

    // present + invalid → fails (rules apply when key IS present)
    expect(s.validate({ username: 'a' }).valid).toBe(false)
  })

  test('sometimes() returns the same validator for chaining', () => {
    const s = schema.string()
    expect(s.sometimes()).toBe(s)
  })
})

describe('introspection: __conditionals is publicly accessible', () => {
  test('downstream readers can walk the conditional shape', () => {
    const fld = schema.string().when('payment_method', 'card', s => s.required())
    const conditionals = (fld as any).__conditionals
    expect(Array.isArray(conditionals)).toBe(true)
    expect(conditionals).toHaveLength(1)
    expect(conditionals[0].field).toBe('payment_method')
    expect(conditionals[0].match).toBe('card')
    expect(typeof conditionals[0].refine).toBe('function')
  })

  test('shouldApplyConditional + applyConditionals are pure', () => {
    const fld = schema.string()
    const augmented = withConditionals(tsV.string() as any)
    augmented.when('flag', true, s => s.required())
    const record = (augmented as any).__conditionals[0]
    expect(shouldApplyConditional(record, { flag: true })).toBe(true)
    expect(shouldApplyConditional(record, { flag: false })).toBe(false)
    expect(shouldApplyConditional(record, null)).toBe(false)
    // applyConditionals against a non-matching parent returns the base
    expect(applyConditionals(fld, { flag: false })).toBe(fld)
  })
})

describe('backward compat: existing object schemas keep working', () => {
  test('object validation without any conditionals is unchanged', () => {
    const s = schema.object({
      email: schema.string().email(),
      age: schema.number().min(18),
    })
    expect(s.validate({ email: 'a@b.com', age: 25 }).valid).toBe(true)
    expect(s.validate({ email: 'not-an-email', age: 25 }).valid).toBe(false)
    expect(s.validate({ email: 'a@b.com', age: 12 }).valid).toBe(false)
  })

  test('object validator getShape() exposes the underlying map', () => {
    const s = schema.object({
      foo: schema.string(),
      bar: schema.number(),
    })
    const shape = s.getShape()
    expect(shape.foo).toBeDefined()
    expect(shape.bar).toBeDefined()
  })
})
