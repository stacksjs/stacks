/**
 * Tax as a sum of parts, with some of them liftable.
 *
 * The tax rates the dashboard manages did not price anything: totals applied a
 * single rate by id, so a business whose tax is several components had to
 * blend them into one number first — and a blended number cannot answer the
 * question that matters when a customer is exempt, which is exempt from
 * *which part*.
 *
 * That is not a niche case. Groceries escape VAT but not a deposit levy. A
 * Californian medical cannabis patient is exempt from sales tax and still pays
 * excise and the city's business tax. With one rate an app has to choose
 * between over-charging the exempt customer and under-collecting tax it owes.
 */

import { describe, expect, it } from 'bun:test'
import { breakdownFor } from '../src/tax/breakdown'

/** The California cannabis case, which is three components and one exemption. */
const rates = [
  { id: 1, code: 'excise', name: 'Cannabis excise', rate: 15, exemptible: false },
  { id: 2, code: 'sales', name: 'State sales tax', rate: 9.5, exemptible: true },
  { id: 3, code: 'city', name: 'City business tax', rate: 2.75, exemptible: false },
]

describe('breakdownFor', () => {
  it('charges every component', () => {
    const result = breakdownFor(10000, rates)

    expect(result.components.map(c => c.amount)).toEqual([1500, 950, 275])
    expect(result.tax).toBe(2725)
    expect(result.exempted).toBe(0)
  })

  it('reads a stored rate as a percentage, not a multiplier', () => {
    // Entered as 15 because that is how tax is written down. Treating it as a
    // multiplier charges a hundred times too much, and does it on a real card.
    expect(breakdownFor(10000, [rates[0]]).tax).toBe(1500)
  })

  it('lifts only the components marked exemptible', () => {
    const result = breakdownFor(10000, rates, { exempt: true })

    expect(result.tax).toBe(1775)
    expect(result.exempted).toBe(950)
    // The other two still apply to an exempt buyer. Lifting them would be the
    // business under-collecting tax it owes the state and the city.
    expect(result.components.filter(c => c.exempted).map(c => c.code)).toEqual(['sales'])
  })

  it('says what each component was, charged or not', () => {
    // A receipt has to itemise, and an audit has to see what was not charged.
    const sales = breakdownFor(10000, rates, { exempt: true }).components.find(c => c.code === 'sales')

    expect(sales).toMatchObject({ code: 'sales', name: 'State sales tax', amount: 0, exempted: true })
  })

  it('leaves the total unchanged when an exempt buyer meets no exemptible component', () => {
    const noneLiftable = rates.filter(r => !r.exemptible)

    expect(breakdownFor(10000, noneLiftable, { exempt: true }).tax)
      .toBe(breakdownFor(10000, noneLiftable).tax)
  })

  it('rounds each component so the parts add up to the total charged', () => {
    /*
     * Rounding once at the end leaves a receipt whose lines are a cent out
     * from the figure underneath them, which is the sort of thing a customer
     * notices and an accountant has to reconcile.
     */
    const result = breakdownFor(3333, rates)
    const summed = result.components.reduce((total, c) => total + c.amount, 0)

    expect(summed).toBe(result.tax)
    for (const component of result.components)
      expect(Number.isInteger(component.amount)).toBe(true)
  })

  it('treats a negative or fractional base as whole non-negative cents', () => {
    expect(breakdownFor(-500, rates).tax).toBe(0)
    expect(breakdownFor(100.6, rates).taxable).toBe(101)
  })

  it('charges nothing when no rate applies', () => {
    expect(breakdownFor(10000, [])).toMatchObject({ tax: 0, exempted: 0, components: [] })
  })

  it('ignores a rate that is not a number rather than charging NaN', () => {
    // A blank rate in the dashboard should cost the customer nothing, not
    // produce a total no payment processor will accept.
    const result = breakdownFor(10000, [{ id: 9, code: 'x', name: 'Broken', rate: null, exemptible: false }])

    expect(result.tax).toBe(0)
  })
})
