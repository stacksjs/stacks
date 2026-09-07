import { describe, expect, test } from 'bun:test'
import { rotateTargets } from './schedule'

describe('benchmark target scheduling', () => {
  test('rotates every target through a different measurement position', () => {
    const targets = ['stacks', 'hono', 'bun-raw']

    expect(rotateTargets(targets, 0)).toEqual(['stacks', 'hono', 'bun-raw'])
    expect(rotateTargets(targets, 1)).toEqual(['hono', 'bun-raw', 'stacks'])
    expect(rotateTargets(targets, 2)).toEqual(['bun-raw', 'stacks', 'hono'])
    expect(rotateTargets(targets, 3)).toEqual(targets)
    expect(targets).toEqual(['stacks', 'hono', 'bun-raw'])
  })

  test('preserves empty and single-target selections', () => {
    expect(rotateTargets([], 99)).toEqual([])
    expect(rotateTargets(['stacks'], 99)).toEqual(['stacks'])
  })
})
