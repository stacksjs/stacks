import { describe, expect, it } from 'bun:test'
import { getCustomMessages } from '@stacksjs/ts-validation'
import { validate } from '../src/request-validator'
import { schema } from '../src/schema'
import { customValidate, validateField } from '../src/validator'

async function errorsOf(run: () => Promise<unknown>): Promise<Record<string, unknown> | 'valid'> {
  try {
    await run()
    return 'valid'
  }
  catch (error) {
    return (error as { details?: { errors: Record<string, unknown> } }).details?.errors ?? {}
  }
}

describe('custom messages reach the errors they name', () => {
  it('validate() uses a field\'s string message for any failure', async () => {
    const errors = await errorsOf(() => validate({ jsonBody: { email: 'nope' } }, {
      email: { rule: schema.string().email(), message: 'Give us an email we can write to' },
    }))
    expect(errors).toEqual({ email: ['Give us an email we can write to'] })
  })

  it('validate() uses a per-rule message for the rule that failed, and the default for the rest', async () => {
    const rules = {
      name: { rule: schema.string().required().min(3).max(5), message: { min: 'Name is too short', max: 'Name is too long' } },
    }
    expect(await errorsOf(() => validate({ jsonBody: { name: 'ab' } }, rules))).toEqual({ name: ['Name is too short'] })
    expect(await errorsOf(() => validate({ jsonBody: { name: 'abcdefgh' } }, rules))).toEqual({ name: ['Name is too long'] })
    expect(await errorsOf(() => validate({ jsonBody: {} }, rules))).toEqual({ name: ['This field is required'] })
  })

  it('validate() takes a key named after the field for failures no rule name matched', async () => {
    const errors = await errorsOf(() => validate({ jsonBody: {} }, {
      title: { rule: schema.string().required(), message: { title: 'Title is required' } },
    }))
    expect(errors).toEqual({ title: ['Title is required'] })
  })

  it('leaves ts-validation\'s process-wide provider alone, so nothing leaks to the next request', async () => {
    const before = getCustomMessages()
    await errorsOf(() => validate({ jsonBody: { email: 'nope' } }, {
      email: { rule: schema.string().email(), message: { email: 'Route A wants a real email' } },
    }))
    expect(getCustomMessages()).toBe(before)
    expect(await errorsOf(() => validate({ jsonBody: { email: 'nope' } }, { email: schema.string().email() })))
      .toEqual({ email: ['Must be a valid email address'] })
  })

  it('customValidate() uses its per-rule messages', async () => {
    const errors = await errorsOf(() => customValidate({
      bio: { rule: schema.string().max(5), message: { max: 'Bio cannot exceed 5 characters' } },
    } as never, { bio: 'far too long' }))
    expect(errors).toEqual({ bio: [{ message: 'Bio cannot exceed 5 characters' }] })
  })

  it('validateField() uses the messages a model declares', async () => {
    // Author declares `name: { min: 'Name must have a minimum of 3 characters' }`
    // and `email: { email: 'Email must be a valid email address' }`.
    const errors = await errorsOf(() => validateField('Author', { name: 'ab', email: 'nope' })) as Record<string, { message: string }[]>
    expect(errors.name?.map(error => error.message)).toEqual(['Name must have a minimum of 3 characters'])
    expect(errors.email?.map(error => error.message)).toEqual(['Email must be a valid email address'])
  })
})
