import { describe, expect, it } from 'bun:test'
import { clampProgressPercent } from '../src/job-progress'

// stacksjs/stacks#1984: setJobProgress used a value-branching heuristic
// (`v <= 1 ? v*100 : v`) to accept both fractions and percents, so a caller
// meaning 1% — `setJobProgress(id, 1)` — jumped to 100%. Progress is now a
// single contract: percent, 0-100.
describe('setJobProgress percent contract (stacksjs/stacks#1984)', () => {
  it('treats the value as a percent, not a fraction', () => {
    expect(clampProgressPercent(1)).toBe(1) // the regression: was 100
    expect(clampProgressPercent(50)).toBe(50)
    expect(clampProgressPercent(12.5)).toBe(12.5) // sub-percent precision preserved
    expect(clampProgressPercent(100)).toBe(100)
  })

  it('does not scale small values (no branching on the magnitude)', () => {
    expect(clampProgressPercent(0)).toBe(0)
    expect(clampProgressPercent(0.5)).toBe(0.5) // 0.5% under the percent contract, not 50%
  })

  it('clamps out-of-range values into [0, 100]', () => {
    expect(clampProgressPercent(150)).toBe(100)
    expect(clampProgressPercent(-5)).toBe(0)
  })

  it('reports 0 for non-finite input', () => {
    expect(clampProgressPercent(Number.NaN)).toBe(0)
    expect(clampProgressPercent(Number.POSITIVE_INFINITY)).toBe(0)
    expect(clampProgressPercent(Number.NEGATIVE_INFINITY)).toBe(0)
  })
})
