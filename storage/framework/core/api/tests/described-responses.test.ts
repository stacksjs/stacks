// What an operation says it answers with.
//
// The generator derives an operation's *inputs* from the action's
// `validations`, which cannot drift because they are the same object the
// validator uses. Its outputs had nowhere to come from, so every operation in
// every generated document said the same three things: 200 with
// `{"type": "object"}`, 422, and 500.
//
// That is worse than it reads. A client generated from such a document knows
// how to call an endpoint and nothing about what comes back, and the 401, 403
// and 404 that most endpoints answer are absent entirely - so the generated
// client has no branch for the cases a caller most needs one for.

import { describe, expect, it } from 'bun:test'
import { describedResponses } from '../src/generate-openapi'

const BASE = {
  200: { description: 'Successful response', content: { 'application/json': { schema: { type: 'object' } } } },
  422: { description: 'Validation failed' },
  500: { description: 'Server error' },
} as any

describe('describedResponses', () => {
  it('leaves an action that documents nothing exactly as it was', () => {
    expect(describedResponses(null, BASE)).toEqual(BASE)
    expect(describedResponses({}, BASE)).toEqual(BASE)
  })

  /*
   * Merged, not replaced. An action that documents its 200 and its 404 still
   * answers 422 for a bad request and 500 when something breaks, and a document
   * that drops those because the author wrote down two is less accurate than
   * one that never let them write anything.
   */
  it('keeps the defaults an action did not mention', () => {
    const responses = describedResponses({
      responses: { 404: { description: 'No such repository' } },
    }, BASE)

    expect(responses['404']!.description).toBe('No such repository')
    expect(responses['422']!.description).toBe('Validation failed')
    expect(responses['500']!.description).toBe('Server error')
  })

  it('replaces a default the action does describe', () => {
    const responses = describedResponses({
      responses: {
        200: { description: 'The checks on a commit', schema: { type: 'object', properties: { sha: { type: 'string' } } } },
      },
    }, BASE)

    expect(responses['200']!.description).toBe('The checks on a commit')
    expect(responses['200']!.content!['application/json']!.schema).toEqual({
      type: 'object',
      properties: { sha: { type: 'string' } },
    } as any)
  })

  it('documents a status with no body at all', () => {
    // "404 - no such repository" is worth saying even when the body is
    // uninteresting, and requiring a schema would mean inventing one.
    const responses = describedResponses({ responses: { 404: { description: 'Not found' } } }, BASE)

    expect(responses['404']).toEqual({ description: 'Not found' })
  })

  it('ignores a row with no sentence beside it', () => {
    // A status with no description is one a reader skims past. Emitting it
    // makes the document longer without making it more useful.
    const responses = describedResponses({
      responses: { 403: { schema: { type: 'object' } } as any, 404: { description: 'Not found' } },
    }, BASE)

    expect(responses['403']).toBeUndefined()
    expect(responses['404']).toBeTruthy()
  })

  describe('response headers', () => {
    const withHeaders = {
      responses: { 429: { description: 'Too many requests' } },
      responseHeaders: {
        'X-RateLimit-Remaining': { description: 'Requests left in this window', schema: { type: 'integer' } },
      },
    }

    /*
     * On every answer, which is what a header on a response *is*. Rate-limit
     * headers ride on the 200 and on the 429 alike, and a client reading them
     * only on success backs off exactly when it should not.
     */
    it('are attached to every answer, not only the successful one', () => {
      const responses = describedResponses(withHeaders, BASE)

      for (const status of ['200', '422', '500', '429'])
        expect(responses[status]!.headers?.['X-RateLimit-Remaining']?.description).toBe('Requests left in this window')
    })

    it('and carry their schema when one was given', () => {
      const responses = describedResponses(withHeaders, BASE)

      expect(responses['200']!.headers!['X-RateLimit-Remaining']!.schema).toEqual({ type: 'integer' } as any)
    })

    it('a header with no description is ignored like a response with none', () => {
      const responses = describedResponses({
        responseHeaders: { 'X-Nothing': { schema: { type: 'string' } } as any },
      }, BASE)

      expect(responses['200']!.headers).toBeUndefined()
    })
  })

  it('does not mutate the defaults it was handed', () => {
    // The same base object is used for every operation in the document, so a
    // mutation here would leak one endpoint's answers into the next one's.
    const base = { 200: { description: 'Successful response' } } as any

    describedResponses({ responses: { 200: { description: 'Something else' } } }, base)

    expect(base['200'].description).toBe('Successful response')
  })
})
