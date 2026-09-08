import { describe, expect, it } from 'bun:test'
import type { EnhancedRequest } from '@stacksjs/bun-router'
import { HttpError } from '@stacksjs/error-handling'
import { schema } from '@stacksjs/validation'
import { enhanceRequest } from '../src/stacks-router'

function requestWith(body: Record<string, unknown>): EnhancedRequest {
  const request = new Request('http://localhost/profile', {
    method: 'POST',
  }) as EnhancedRequest
  request.jsonBody = body
  return enhanceRequest(request)
}

describe('request validation helpers', () => {
  it('validates input and exposes safe validated data', async () => {
    const request = requestWith({ name: 'Stacks', ignored: 'value' })
    const validated = await request.validate({
      name: { rule: schema.string().min(3) },
    })

    expect(validated.name).toBe('Stacks')
    expect(request.getValidated().name).toBe('Stacks')
    expect(request.safe().only(['name'])).toEqual({ name: 'Stacks' })
    expect(request.safe().except(['ignored'])).toEqual({ name: 'Stacks' })
  })

  it('throws a structured 422 for invalid input', async () => {
    const request = requestWith({ name: '' })

    try {
      await request.validate({
        name: { rule: schema.string().required().min(3) },
      })
      throw new Error('Expected validation to fail')
    }
    catch (error) {
      expect(error).toBeInstanceOf(HttpError)
      expect((error as HttpError).status).toBe(422)
      const details = (error as HttpError).details as { errors: Record<string, string[]> }
      expect(details.errors.name.length).toBeGreaterThan(0)
    }
  })

  it('uses model rules supplied by the action resolver', async () => {
    const request = requestWith({ name: 'Native model' })
    ;(request as any)._requestValidationRules = {
      name: { rule: schema.string().min(3) },
    }

    const validated = await request.validate()
    expect(validated.name).toBe('Native model')
  })

  it('keeps warmed validation rules and results specific to each request', async () => {
    const rules = { name: { rule: schema.string().required().min(3) } }
    const first = requestWith({ name: 'Stacks' })
    const second = requestWith({ name: 42 })
    const results = await Promise.all([
      first.validate(rules),
      second.validate({ name: schema.number().required() }),
    ])
    expect(results).toEqual([{ name: 'Stacks' }, { name: 42 }])
    expect(first.getValidated()).toEqual({ name: 'Stacks' })
    expect(second.getValidated()).toEqual({ name: 42 })

    rules.name.rule = schema.string().required().max(2)
    await expect(requestWith({ name: 'Stacks' }).validate(rules)).rejects.toBeInstanceOf(HttpError)
    rules.name.rule = schema.string().required().min(3)
    expect(await requestWith({ name: 'Changed' }).validate(rules)).toEqual({ name: 'Changed' })
  })

  it('retains empty-rule input and rejects string rules after warming', async () => {
    const request = requestWith({ name: 'Stacks', extra: true })
    await request.validate({ name: schema.string().required() })
    expect(await request.validate({})).toEqual({ name: 'Stacks', extra: true })
    await expect(request.validate({ name: 'required' })).rejects.toBeInstanceOf(TypeError)
  })
})
