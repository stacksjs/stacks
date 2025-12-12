// ts-pantry stub - Utility functions
export function deepMerge<T>(target: T, source: Partial<T>): T {
  return { ...target, ...source }
}
export default { deepMerge }
