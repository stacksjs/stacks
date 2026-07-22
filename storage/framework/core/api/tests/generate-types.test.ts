import { describe, expect, it } from 'bun:test'
import { renderOpenApiTypes, schemaType } from '../src/generate-types'

describe('OpenAPI type generation', () => {
  it('renders required path parameters, request bodies, and responses deterministically', () => {
    const document = {
      paths: {
        '/users/{id}': {
          patch: {
            parameters: [{ name: 'id', in: 'path' as const, required: true, schema: { type: 'string' } }],
            requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string' }, active: { type: 'boolean' } } } } } },
            responses: { 200: { content: { 'application/json': { schema: { type: 'object' } } } } },
          },
        },
      },
      components: { schemas: {} },
    }
    const first = renderOpenApiTypes(document)
    expect(renderOpenApiTypes(document)).toBe(first)
    expect(first).toContain(`path: { "id": string }`)
    expect(first).toContain(`requestBody: { content: { "application/json": { "name": string; "active"?: boolean } } }`)
  })

  it('maps arrays, enums, and dictionaries without using any', () => {
    expect(schemaType({ type: 'array', items: { enum: ['ready', 'failed'] } })).toBe('Array<"ready" | "failed">')
    expect(schemaType({ type: 'object', additionalProperties: { type: 'number' } })).toBe('{ [key: string]: number }')
  })
})
