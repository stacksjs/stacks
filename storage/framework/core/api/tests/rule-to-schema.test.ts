/**
 * Validation rules, as OpenAPI schema fragments.
 *
 * This is the piece the whole document rests on, and it was silently wrong:
 * it duck-typed `_type` / `_min` / `_email` / `_enum`, none of which the
 * validation library has, so every field of every documented endpoint came
 * out as `{ type: 'string' }` with no constraints. A document that types
 * everything as a string is worse than one that says nothing - a client
 * generated from it compiles, then sends `"12"` where the server wanted `12`.
 *
 * So these assert against real `schema.*` objects rather than hand-written
 * ones. A hand-written stand-in would have kept passing through the entire
 * period the real thing was broken.
 */

import { describe, expect, it } from 'bun:test'
import { schema } from '@stacksjs/validation'
import { ruleIsRequired, ruleToSchema } from '../src/generate-openapi'

describe('types', () => {
  it('reads a number as a number', () => {
    expect(ruleToSchema(schema.number())).toEqual({ type: 'number' })
  })

  it('and a string as a string', () => {
    expect(ruleToSchema(schema.string())).toEqual({ type: 'string' })
  })

  it('and a boolean and an array as themselves', () => {
    expect(ruleToSchema(schema.boolean())).toEqual({ type: 'boolean' })
    expect(ruleToSchema(schema.array())).toEqual({ type: 'array' })
  })

  it('describes an enum as a string with choices', () => {
    // `type: 'enum'` is not an OpenAPI type. The choices are the whole point,
    // and a client generator turns them into a union.
    expect(ruleToSchema(schema.enum(['approved', 'commented']))).toEqual({
      type: 'string',
      enum: ['approved', 'commented'],
    })
  })
})

describe('constraints', () => {
  it('bounds a string by length', () => {
    expect(ruleToSchema(schema.string().min(3).max(10))).toEqual({
      type: 'string',
      minLength: 3,
      maxLength: 10,
    })
  })

  it('and a number by value', () => {
    // Emitting `minimum` for a string is not merely unhelpful: it is a
    // constraint a strict validator will try to enforce against text.
    expect(ruleToSchema(schema.number().min(1).max(9))).toEqual({
      type: 'number',
      minimum: 1,
      maximum: 9,
    })
  })

  it('carries a format across', () => {
    expect(ruleToSchema(schema.string().email())).toEqual({ type: 'string', format: 'email' })
    expect(ruleToSchema(schema.string().url())).toEqual({ type: 'string', format: 'uri' })
  })
})

describe('presence', () => {
  it('sees a required rule', () => {
    expect(ruleIsRequired(schema.string().required())).toBe(true)
  })

  it('and does not invent one', () => {
    expect(ruleIsRequired(schema.string())).toBe(false)
  })

  it('answers for nothing at all rather than throwing', () => {
    // The generator runs over every route in the app. One malformed
    // declaration should not take the whole document down.
    expect(ruleIsRequired(undefined)).toBe(false)
    expect(ruleToSchema(undefined)).toEqual({ type: 'string' })
  })
})
