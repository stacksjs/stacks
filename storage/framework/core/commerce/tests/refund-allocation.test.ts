import { expect, test } from 'bun:test'
import { allocateRefund, refundTaxDelta } from '../src/refund-allocation'

test('refunds return both tenders, including entirely credit-paid sales', () => {
  expect(allocateRefund(1000, 600, 400)).toEqual({ cash: 600, credit: 400 })
  expect(allocateRefund(1000, 0, 1000)).toEqual({ cash: 0, credit: 1000 })
  expect(allocateRefund(200, 600, 400)).toEqual({ cash: 200, credit: 0 })
  expect(() => allocateRefund(1001, 600, 400)).toThrow()
})
test('split refunds reverse exactly the original rounded tax', () => {
  expect(refundTaxDelta(0, 1, 3, 1) + refundTaxDelta(1, 1, 3, 1) + refundTaxDelta(2, 1, 3, 1)).toBe(1)
})
