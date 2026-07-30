import { describe, expect, it } from 'bun:test'
import { schema } from '@stacksjs/validation'
import { Action } from '../src/action'

describe('Action model validation metadata', () => {
  it('preserves the model definition alongside its normalized name', () => {
    const model = {
      name: 'Product',
      attributes: {
        name: {
          validation: {
            rule: schema.string().required(),
          },
        },
      },
    }
    const action = new Action({
      model,
      handle: () => ({ ok: true }),
    })

    expect(action.model).toBe('Product')
    expect(action.modelDefinition).toBe(model)
  })
})
