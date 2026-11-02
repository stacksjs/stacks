import { expect, test } from 'bun:test'
import { objectPick } from '../src/index'

test('picked prototype keys remain own data without changing the result prototype', () => {
  const source = JSON.parse('{"__proto__":{"admin":true},"constructor":"value","name":"Alice"}')
  const result = objectPick(source, ['__proto__', 'constructor', 'name'])
  expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
  expect(Object.hasOwn(result, '__proto__')).toBe(true)
  expect(result.__proto__).toEqual({ admin: true })
  expect(result.admin).toBeUndefined()
  expect(result.constructor).toBe('value')
  expect(result.name).toBe('Alice')
  expect(objectPick({ a: undefined, b: 0 }, ['a', 'b'], true)).toEqual({ b: 0 })
})
