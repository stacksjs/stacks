import { describe, expect, it } from 'bun:test'
import { schema } from '@stacksjs/validation'
import { modelDefinitionToSchema } from '../src/generate-openapi'

describe('model OpenAPI schemas', () => {
  it('describes public model fields, relations, and framework traits', () => {
    const result = modelDefinitionToSchema({
      name: 'Contact',
      belongsTo: ['Team'],
      traits: { useUuid: true, useTimestamps: true },
      attributes: {
        firstName: { required: true, validation: { rule: schema.string().max(100) } },
        status: { required: true, validation: { rule: schema.enum(['active', 'suppressed']) } },
        encryptedValue: { hidden: true, validation: { rule: schema.string() } },
      },
    })

    expect(result.properties?.first_name).toEqual({ type: 'string', maxLength: 100 })
    expect(result.properties?.status).toEqual({ type: 'string', enum: ['active', 'suppressed'] })
    expect(result.properties?.team_id).toEqual({ type: 'integer' })
    expect(result.properties?.uuid).toEqual({ type: 'string', format: 'uuid' })
    expect(result.properties?.created_at).toEqual({ type: 'string', format: 'date-time' })
    expect(result.properties?.encrypted_value).toBeUndefined()
    expect(result.required).toEqual(['id', 'uuid', 'first_name', 'status'])
  })

  it('describes soft-delete timestamps as nullable', () => {
    const result = modelDefinitionToSchema({ traits: { useSoftDeletes: true }, attributes: {} })
    expect(result.properties?.deleted_at).toEqual({ type: 'string', format: 'date-time', nullable: true })
  })
})
