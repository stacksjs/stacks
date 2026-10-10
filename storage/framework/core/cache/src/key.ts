export type CacheKeyPart = string | number | boolean | null | undefined

/** Include every representation setting in a deterministic key, without delimiter collisions. */
export function cacheKey(namespace: string, dependencies: Record<string, CacheKeyPart>): string {
  const values = Object.keys(dependencies).sort().map(key => {
    const value = dependencies[key]
    if (typeof value === 'number' && !Number.isFinite(value)) throw new RangeError('Cache key numbers must be finite')
    if (value !== undefined && value !== null && !['string', 'number', 'boolean'].includes(typeof value)) throw new TypeError('Invalid cache key value')
    return [key, value === undefined ? ['undefined'] : value]
  })
  return JSON.stringify([namespace, values])
}
