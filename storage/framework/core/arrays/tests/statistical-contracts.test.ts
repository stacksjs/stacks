import { expect, test } from 'bun:test'
import { covariance, standardDeviation, variance, zScore } from '../src/math'

function close(actual: number, expected: number): void {
  expect(Number.isFinite(actual)).toBe(true)
  expect(Math.abs(actual / expected - 1)).toBeLessThan(1e-14)
}

test('population dispersion retains representable large and tiny results', () => {
  close(variance([2e154, -2e154, 0, 0, 0, 0, 0, 0]), 1e308)
  close(standardDeviation([1e200, -1e200]), 1e200)
  close(standardDeviation([1e-200, -1e-200]), 1e-200)
  close(standardDeviation([1e16, 1e16 + 2]), 1)
  expect(variance([1e200, -1e200])).toBe(Infinity)
  expect(variance([1e-200, -1e-200])).toBe(0)
  expect(variance([0, 0])).toBe(0)
  expect(standardDeviation([0, 0])).toBe(0)
})

test('standard scores normalize before subtraction can overflow', () => {
  close(zScore([-1e308, 0], 1e308), 3)
  close(zScore([-Number.MAX_VALUE, 0], Number.MAX_VALUE), 3)
  close(zScore([-1e-200, 1e-200], 1e-200), 1)
  expect(zScore([1, 1], 1)).toBeNaN()
  expect(zScore([1, 1], 2)).toBe(Infinity)
})

test('covariance cancels large products and preserves opposite scales', () => {
  close(covariance([1e16, -1e16, 1, -1], [1, -1, 1e16, -1e16]), 1e16)
  close(covariance([1e308, -1e308, 1e-308, -1e-308], [1e-308, -1e-308, 1e308, -1e308]), 1)
  const scale = 2 ** 665
  expect(covariance([-3, -3, -4, -5, -1].map(value => value * scale), [5, 4, 5, 0, 1].map(value => value * scale))).toBe(0)
  expect(covariance([1e200, 1e200, -1e200, -1e200], [1e200, -1e200, 1e200, -1e200])).toBe(0)
  close(covariance([-1e-200, 1e-200], [-1e200, 1e200]), 1)
  close(covariance([-1e154, 1e154], [1e154, -1e154]), -1e308)
  expect(() => covariance([1], [1, 2])).toThrow()
})

test('dispersion retains nonfinite and empty-input contracts', () => {
  for (const operation of [variance, standardDeviation]) {
    expect(() => operation([])).toThrow()
    expect(operation([NaN, 1])).toBeNaN()
    expect(operation([Infinity, 1])).toBeNaN()
  }
  expect(covariance([Infinity, 1], [1, 2])).toBeNaN()
})

test('covariance rounds subnormal ties once and overflows only the final result', () => {
  const tiny = Number.MIN_VALUE
  expect(covariance([0, 2], [0, tiny])).toBe(0)
  expect(covariance([0, 6], [0, tiny])).toBe(2 * tiny)
  expect(covariance([0, 10], [0, tiny])).toBe(2 * tiny)
  expect(Object.is(covariance([0, -2], [0, tiny]), -0)).toBe(true)
  expect(covariance([-Number.MAX_VALUE, Number.MAX_VALUE], [-1, 1])).toBe(Number.MAX_VALUE)
  expect(covariance([-Number.MAX_VALUE, Number.MAX_VALUE], [-2, 2])).toBe(Infinity)
})
