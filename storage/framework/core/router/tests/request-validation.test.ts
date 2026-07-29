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
})
