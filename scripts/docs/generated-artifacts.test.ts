import { describe, expect, it } from 'bun:test'
import { validateOpenApi } from './generated-artifacts'

describe('generated API artifact validation', () => {
  it('rejects empty, duplicate, and optional path evidence', () => {
    expect(validateOpenApi({ paths: {} })).toContain('OpenAPI document has fewer than 10 registered paths')
    const paths: Record<string, any> = {}
    for (let index = 0; index < 10; index++) {
      paths[`/items/${index}/{id}`] = {
        get: {
          operationId: index < 2 ? 'duplicate' : `get_${index}`,
          parameters: [{ name: 'id', in: 'path', required: index !== 2, schema: { type: 'string' } }],
          responses: {},
        },
      }
    }
    const errors = validateOpenApi({ paths })
    expect(errors).toContain('GET /items/1/{id}: duplicate operationId duplicate')
    expect(errors).toContain('GET /items/2/{id}: path parameter id must be required')
  })
})
