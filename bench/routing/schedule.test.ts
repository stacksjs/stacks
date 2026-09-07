import { describe, expect, test } from 'bun:test'
import { balancedTargetOrder } from './schedule'

describe('balanced benchmark target scheduling', () => {
  test('balances cumulative positions across three odd-sized runs', () => {
    expect(positionTotals(7)).toEqual([9, 9, 9, 9, 9, 9, 9])
  })

  test('uses the closest possible balance for an even target count', () => {
    expect(positionTotals(8)).toEqual([10, 10, 10, 10, 11, 11, 11, 11])
  })

  test('balances additional repeats with complementary pairs', () => {
    expect(positionTotals(7, 4)).toEqual([12, 12, 12, 12, 12, 12, 12])
    expect(positionTotals(8, 4)).toEqual([14, 14, 14, 14, 14, 14, 14, 14])
    expect(positionTotals(7, 5)).toEqual([15, 15, 15, 15, 15, 15, 15])
    expect(positionTotals(8, 5)).toEqual([17, 17, 17, 17, 18, 18, 18, 18])
  })

  test('repeats a deterministic triplet without mutating the input', () => {
    const targets = ['stacks', 'hono', 'bun-raw']
    expect(balancedTargetOrder(targets, 0)).toEqual(['stacks', 'hono', 'bun-raw'])
    expect(balancedTargetOrder(targets, 1)).toEqual(['bun-raw', 'stacks', 'hono'])
    expect(balancedTargetOrder(targets, 2)).toEqual(['hono', 'bun-raw', 'stacks'])
    expect(balancedTargetOrder(targets, 3)).toEqual(targets)
    expect(targets).toEqual(['stacks', 'hono', 'bun-raw'])
  })

  test('preserves empty and single-target selections', () => {
    expect(balancedTargetOrder([], 99)).toEqual([])
    expect(balancedTargetOrder(['stacks'], 99)).toEqual(['stacks'])
  })
})

function positionTotals(targetCount: number, runs = 3): number[] {
  const targets = Array.from({ length: targetCount }, (_, index) => index)
  const totals = Array.from({ length: targetCount }, () => 0)
  for (let run = 0; run < runs; run++) {
    for (const [position, target] of balancedTargetOrder(targets, run, runs).entries())
      totals[target]! += position
  }
  return totals
}
