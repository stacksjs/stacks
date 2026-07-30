import { describe, expect, test } from 'bun:test'
import { componentPrefix } from '../../storage/framework/core/actions/src/build/component-library'

describe('component library build', () => {
  test('derives stable custom-element prefixes from package names', () => {
    expect(componentPrefix('stacks')).toBe('stacks')
    expect(componentPrefix('@acme/admin-components')).toBe('admin')
    expect(componentPrefix('@acme/product-stx')).toBe('product')
    expect(componentPrefix(undefined)).toBe('stx')
    expect(componentPrefix('---')).toBe('stx')
  })
})
