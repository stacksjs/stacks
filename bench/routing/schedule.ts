/**
 * Spread each target across process positions without losing the balanced
 * average position used by short publication profiles. Runs that cover at
 * least one complete target cycle use cyclic permutations, so every target
 * receives every process position before any position repeats. A partial
 * cycle selects evenly spaced rotations to minimize its position bias.
 * Short profiles retain the balanced triplet and complementary-pair design.
 */
export function balancedTargetOrder<T>(targets: readonly T[], runIndex: number, totalRuns = 3): T[] {
  if (targets.length < 2)
    return [...targets]

  if (totalRuns >= targets.length) {
    const scheduledRun = ((runIndex % totalRuns) + totalRuns) % totalRuns
    const completeRuns = Math.floor(totalRuns / targets.length) * targets.length
    const remainder = totalRuns - completeRuns
    const remainderIndex = scheduledRun - completeRuns
    const offset = scheduledRun < completeRuns
      ? scheduledRun % targets.length
      : Math.floor(remainderIndex * targets.length / remainder)
    return [...targets.slice(offset), ...targets.slice(0, offset)]
  }

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
