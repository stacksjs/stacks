import { describe, expect, it } from 'bun:test'
import { scaleBand, scaleLinear } from '@ts-charts/scale'

/**
 * The Chart class delegates X/Y pixel mapping to ts-charts' `scaleLinear`
 * and bar grouping to `scaleBand`. These tests pin down the contract we
 * rely on: that the new ts-charts-backed math produces visually
 * equivalent positions to the old hand-rolled arithmetic, so chart
 * layouts don't drift between releases.
 */
describe('chart scale math via ts-charts', () => {
  it('scaleLinear maps the y-axis with the standard inverted range', () => {
    // Plot occupies y ∈ [0, 100]; values run [0, 200] in domain space.
    // The smaller domain value (0) should land at the BOTTOM of the
    // plot (pixel 100), the larger (200) at the TOP (pixel 0). This
    // mirrors the inversion `chart.ts` applies for canvas Y.
    const s = scaleLinear().domain([0, 200]).range([100, 0])
    expect(s(0)).toBe(100)
    expect(s(200)).toBe(0)
    expect(s(100)).toBe(50)
  })

  it('scaleLinear distributes evenly-spaced indices across the plot width', () => {
    // The line/area renderer maps `(count, i) -> px` with `scaleLinear`
    // domain [0, count - 1] and range [plot.x, plot.x + plot.w]. With
    // count = 5 across [0, 100] we expect points at 0, 25, 50, 75, 100.
    const s = scaleLinear().domain([0, 4]).range([0, 100])
    expect(s(0)).toBe(0)
    expect(s(1)).toBe(25)
    expect(s(2)).toBe(50)
    expect(s(3)).toBe(75)
    expect(s(4)).toBe(100)
  })

  it('scaleBand bandwidth is roughly groupWidth = (plot.w / count) * (1 - paddingInner)', () => {
    // Old code: `groupWidth = (plot.w / count) * 0.7`. New code uses
    // `scaleBand().paddingInner(0.3)` over the same count. The two
    // should agree to within rounding when paddings consume the gaps
    // *between* bands rather than at the edges. d3-scale's default
    // band layout puts inner padding between bands plus optional
    // outer padding at the ends; with `paddingOuter` defaulting to 0
    // (the same as scaleBand's default), the bandwidth comes out as:
    //   bandwidth = (plot.w - innerGaps) / count  where
    //   innerGaps = (count - 1) * paddingInner * step
    // and `step = plot.w / (count - paddingInner * (count - 1))`.
    const count = 8
    const plotW = 800
    const expected = (plotW / count) * 0.7

    const xBand = scaleBand()
      .domain(Array.from({ length: count }, (_, i) => i))
      .range([0, plotW])
      .paddingInner(0.3)

    const bw = xBand.bandwidth()
    // Allow for d3-scale's slightly different gap allocation. We
    // accept anything within 5% of the legacy width.
    expect(Math.abs(bw - expected) / expected).toBeLessThan(0.05)
  })

  it('scaleBand returns a unique left-edge per category in domain order', () => {
    const xBand = scaleBand().domain([0, 1, 2, 3]).range([0, 200]).paddingInner(0.3)
    const x0 = xBand(0)
    const x1 = xBand(1)
    const x2 = xBand(2)
    const x3 = xBand(3)
    expect(x1).toBeGreaterThan(x0)
    expect(x2).toBeGreaterThan(x1)
    expect(x3).toBeGreaterThan(x2)
  })
})
