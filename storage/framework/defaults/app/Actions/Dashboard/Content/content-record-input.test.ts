import type { RequestInstance } from '@stacksjs/types'
import { describe, expect, test } from 'bun:test'
import { insertedId, rowId } from './content-input'
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

// What an insert answers with on each driver (stacksjs/stacks#3004).
describe('the id of an inserted content row', () => {
  test('reads the row returningAll() gives back, with PostgreSQL\'s string id', () => {
    expect(insertedId({ id: '64', name: 'Example' })).toBe(64)
    expect(insertedId([{ id: 7 }])).toBe(7)
  })

  test('reads SQLite\'s and MySQL\'s insert reports', () => {
    expect(insertedId({ changes: 1, lastInsertRowid: 12 })).toBe(12)
    expect(insertedId({ insertId: 9n })).toBe(9)
  })

  test('is 0 when nothing names a row, as PostgreSQL answers without RETURNING', () => {
    expect(insertedId([])).toBe(0)
    expect(insertedId(undefined)).toBe(0)
    expect(insertedId({ id: 'not-an-id' })).toBe(0)
  })
})
