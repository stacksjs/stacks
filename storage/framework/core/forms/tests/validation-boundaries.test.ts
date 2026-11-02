import { expect, test } from 'bun:test'
import { validateSubmission } from '../src/validate'
import { visibleFields } from '../src/conditions'
import { field, form } from './fixtures/definitions'

test('hidden controller values cannot hide a required visible field', () => {
  const definition = form([
    field('kind', 'select', { options: { choices: [{ label: 'Personal', value: 'personal' }, { label: 'Business', value: 'business' }] } }),
    field('company', 'text', { conditions: { action: 'show', logic: 'all', rules: [{ field: 'kind', op: 'eq', value: 'business' }] } }),
    field('tax', 'text', { conditions: { action: 'hide', logic: 'all', rules: [{ field: 'company', op: 'eq', value: 'exempt' }] } }),
  ])
  expect(validateSubmission(definition, { kind: 'personal', company: 'exempt' }).ok).toBe(false)
  expect(visibleFields(definition.fields, { kind: 'personal', company: 'exempt' }).map(item => item.name)).toEqual(['kind', 'tax'])
  expect(validateSubmission(definition, { kind: 'personal', tax: '123' }).ok).toBe(true)
  expect(validateSubmission(definition, { kind: 'business', company: 'exempt' }).ok).toBe(true)
  expect(visibleFields([...definition.fields].reverse(), { kind: 'personal', company: 'exempt' }).map(item => item.name).sort()).toEqual(['kind', 'tax'])
})

test('reserved names and inherited payload values cannot bypass validation', () => {
  for (const name of ['__proto__', 'constructor', 'prototype']) {
    expect(validateSubmission(form([field(name)]), {}).ok).toBe(false)
    expect(validateSubmission(form([field(name)]), JSON.parse(`{"${name}":"submitted"}`)).ok).toBe(false)
  }
  expect(validateSubmission(form([field('name')]), Object.create({ name: 'inherited' })).ok).toBe(false)
})

test('cyclic visibility rules reject submissions instead of hiding all required fields', () => {
  const definition = form([
    field('a', 'text', { conditions: { action: 'show', logic: 'all', rules: [{ field: 'b', op: 'not_empty' }] } }),
    field('b', 'text', { conditions: { action: 'show', logic: 'all', rules: [{ field: 'a', op: 'not_empty' }] } }),
  ])
  expect(validateSubmission(definition, { a: 'one', b: 'two' }).ok).toBe(false)
})

test('currency accepts only safe nonnegative integer cents or decimal digit strings', () => {
  const definition = form([field('amount', 'currency')])
  for (const amount of [true, false, [], [1], {}, '0x10', '1e3', '1.5', -1, 0.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, '9007199254740993'])
    expect(validateSubmission(definition, { amount }).ok).toBe(false)
  for (const amount of [0, 123, '123', Number.MAX_SAFE_INTEGER])
    expect(validateSubmission(definition, { amount }).ok).toBe(true)
})

test('payment sums reject overflow even when individual amounts are safe', () => {
  const definition = form([field('a', 'currency'), field('b', 'currency')], { payment: { mode: 'field_sum' } })
  expect(validateSubmission(definition, { a: Number.MAX_SAFE_INTEGER, b: 2 }).ok).toBe(false)
  const result = validateSubmission(definition, { a: 100, b: '250' })
  expect(result.ok && result.amountCents).toBe(350)
})

test('payment amounts require a currency source and a safe configured amount', () => {
  const wrong = form([field('amount', 'text')], { payment: { mode: 'user_amount', amountField: 'amount' } })
  for (const amount of ['Infinity', '100']) expect(validateSubmission(wrong, { amount }).ok).toBe(false)
  const valid = form([field('amount', 'currency')], { payment: { mode: 'user_amount', amountField: 'amount', minAmountCents: 100 } })
  expect(validateSubmission(valid, { amount: '50' }).ok).toBe(true)
  expect(validateSubmission(valid, { amount: '150' })).toMatchObject({ ok: true, amountCents: 150 })
  for (const amountCents of [-1, Infinity, Number.MAX_SAFE_INTEGER + 1])
    expect(validateSubmission(form([], { payment: { mode: 'fixed', amountCents } }), {}).ok).toBe(false)
})

test('date fields accept canonical calendar dates and reject normalized or non-date input', () => {
  const definition = form([field('date', 'date')])
  for (const date of ['2024-02-30', '2023-02-29', '2024-13-01', '1', '2024-01-01T12:00:00Z'])
    expect(validateSubmission(definition, { date }).ok).toBe(false)
  expect(validateSubmission(definition, { date: '2024-02-29' }).ok).toBe(true)
})
