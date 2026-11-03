import { expect, test } from 'bun:test'
import { Pipeline } from '../src/pipeline'

test('pipeline builders snapshot definitions and keep appended pipes local', () => {
  const increment = (n: number, next: (n: number) => number) => next(n + 1)
  const shared = [increment]
  const first = Pipeline.send(1).through(shared)
  const second = Pipeline.send(1).through(shared)
  first.pipe((n, next) => next(n * 10))
  expect(first.thenReturn()).toBe(20)
  expect(second.thenReturn()).toBe(2)
  shared.push(increment)
  expect(second.thenReturn()).toBe(2)
  expect(shared).toHaveLength(2)
})
