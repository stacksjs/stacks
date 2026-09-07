/**
 * Spread each target evenly across early, middle, and late positions in the
 * three-run publication profile. A simple one-place rotation leaves a
 * seven-target memory run strongly biased because only three of seven
 * positions are sampled. This triplet gives every target the same cumulative
 * position when the target count is odd, and the mathematically minimal
 * one-position difference when it is even.
 */
export function balancedTargetOrder<T>(targets: readonly T[], runIndex: number, totalRuns = 3): T[] {
  if (targets.length < 2)
    return [...targets]

  // Even run counts decompose entirely into complementary pairs. For odd
  // counts, use the balanced triplet once and pair every remaining run.
  // Each pair contributes the same position total to every target.
  if (totalRuns % 2 === 0 || runIndex >= 3) {
    const pairIndex = totalRuns % 2 === 0 ? runIndex : runIndex - 3
    return pairIndex % 2 === 0 ? [...targets] : [...targets].reverse()
  }

  const phase = ((runIndex % 3) + 3) % 3
  if (phase === 0)
    return [...targets]
  if (phase === 1) {
    const offset = Math.ceil(targets.length / 2)
    return [...targets.slice(offset), ...targets.slice(0, offset)]
  }

  const order: T[] = []
  const lowerMiddle = Math.floor((targets.length - 1) / 2)
  let low = lowerMiddle
  let high = targets.length - 1
  while (low >= 0) {
    order.push(targets[low]!)
    if (high > lowerMiddle)
      order.push(targets[high]!)
    low--
    high--
  }
  return order
}
