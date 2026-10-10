import { expect, test } from 'bun:test'
import { cacheKey } from '../src/key'

test('keys include representation settings and ignore property insertion order', () => {
  const full = cacheKey('activity', { id: 1, privacy: false, name: 'Athlete' })
  expect(cacheKey('activity', { name: 'Athlete', privacy: false, id: 1 })).toBe(full)
  expect(cacheKey('activity', { id: 1, privacy: true, name: 'Athlete' })).not.toBe(full)
  expect(cacheKey('activity', { a: 'x:y', b: 'z' })).not.toBe(cacheKey('activity', { a: 'x', b: 'y:z' }))
  expect(cacheKey('activity', { value: undefined })).not.toBe(cacheKey('activity', { value: null }))
  expect(() => cacheKey('activity', { value: NaN })).toThrow(RangeError)
})
