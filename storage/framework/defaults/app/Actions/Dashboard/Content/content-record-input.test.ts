import type { RequestInstance } from '@stacksjs/types'
import { describe, expect, test } from 'bun:test'
import { rowId } from './content-input'
import { parseAuthorInput } from './author-input'
import { parsePageInput, parsePublished } from './page-input'

function request(values: Record<string, unknown>): RequestInstance {
  return {
    get(key: string) {
      return values[key]
    },
  } as RequestInstance
}

describe('dashboard content record input', () => {
  test('parses author fields from the provided request', () => {
    expect(parseAuthorInput(request({
      name: '  Example Author  ',
      email: 'author@example.test',
      bio: '  Profile  ',
      avatar: 'https://example.test/avatar.jpg',
    }))).toEqual({
      data: {
        name: 'Example Author',
        email: 'author@example.test',
        bio: 'Profile',
        avatar: 'https://example.test/avatar.jpg',
      },
    })
  })

  test('enforces the Author model validation contract', () => {
    expect(parseAuthorInput(request({ name: 'Tiny', email: 'invalid' }))).toEqual({
      message: 'Name must be between 5 and 255 characters.',
    })
  })

  test('parses page fields and publishing values', () => {
    expect(parsePageInput(request({ title: '  About us  ', template: 'landing' }))).toEqual({
      data: { title: 'About us', template: 'landing' },
    })
    expect(parsePublished(true)).toBe(true)
    expect(parsePublished('1')).toBe(true)
    expect(parsePublished(false)).toBe(false)
  })
})


test('content identifiers use the shared safe-integer contract', () => {
  for (const value of [true, {}, [], Number.MAX_SAFE_INTEGER + 1]) expect(rowId({ getParam: () => value } as unknown as RequestInstance)).toBe(0)
  expect(rowId({ getParam: () => '42' } as unknown as RequestInstance)).toBe(42)
})
