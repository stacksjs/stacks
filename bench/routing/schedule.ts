/**
 * Rotate target order between measurements so a consistently warming or
 * throttling host does not always favor the same implementation.
 */
export function rotateTargets<T>(targets: readonly T[], measurementIndex: number): T[] {
  if (targets.length < 2)
    return [...targets]

  const offset = measurementIndex % targets.length
  return offset === 0
    ? [...targets]
    : [...targets.slice(offset), ...targets.slice(0, offset)]
}
