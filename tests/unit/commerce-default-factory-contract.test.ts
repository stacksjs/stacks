import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string): string {
  return readFileSync(resolve(path), 'utf8')
}

function defaultAttribute(model: string): string {
  const start = model.indexOf('isDefault: {')
  const end = model.indexOf('\n    },', start)
  return model.slice(start, end)
}

describe('commerce default factory contract', () => {
  test('exclusive default flags are never randomized by seed factories', () => {
    const productUnit = source('storage/framework/defaults/app/Models/commerce/ProductUnit.ts')
    const taxRate = source('storage/framework/defaults/app/Models/commerce/TaxRate.ts')

    expect(defaultAttribute(productUnit)).toContain('factory: () => false')
    expect(defaultAttribute(taxRate)).toContain('factory: () => false')
  })
})
