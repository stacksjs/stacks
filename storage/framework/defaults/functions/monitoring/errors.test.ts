import { describe, expect, it } from 'bun:test'
import { errorGroupParams } from './errors'

describe('errorGroupParams', () => {
  it('encodes group identifiers exactly once', () => {
    const params = errorGroupParams('Type/Error', 'Failed at 50%')

    expect(params.toString()).toBe('type=Type%2FError&message=Failed+at+50%25')
    expect(params.get('type')).toBe('Type/Error')
    expect(params.get('message')).toBe('Failed at 50%')
  })
})
