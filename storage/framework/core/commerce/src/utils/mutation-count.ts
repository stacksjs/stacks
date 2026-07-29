export function mutationCount(result: unknown): number {
  if (typeof result === 'number')
    return Number.isFinite(result) ? result : 0
  if (typeof result === 'bigint')
    return Number(result)
  if (!result || typeof result !== 'object')
    return 0

  const record = result as Record<string, unknown>
  for (const key of ['changes', 'affectedRows', 'count', 'numAffectedRows', 'numDeletedRows', 'numInsertedOrUpdatedRows', 'numUpdatedRows']) {
    if (record[key] !== undefined && record[key] !== null)
      return mutationCount(record[key])
  }
  if (Array.isArray(result))
    return result.reduce((total, item) => total + mutationCount(item), 0)
  return 0
}
