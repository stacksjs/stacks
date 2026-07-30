export interface NumericSummaryRow {
  total?: number | string | null
  average?: number | string | null
  maximum?: number | string | null
  latest?: string | null
}

export interface StatusCountRow {
  status?: string | null
  count?: number | string | null
}

export function finiteNumber(value: unknown): number {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

export function countValue(value: unknown): number {
  return Math.max(0, Math.trunc(finiteNumber(value)))
}

export function percent(numerator: unknown, denominator: unknown): number {
  const total = finiteNumber(denominator)
  if (total <= 0)
    return 0

  return Math.min(100, Math.max(0, (finiteNumber(numerator) / total) * 100))
}

export function summarizeStatuses(rows: StatusCountRow[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((summary, row) => {
    const status = String(row.status || '').trim().toLowerCase()
    if (status)
      summary[status] = countValue(row.count)
    return summary
  }, {})
}

export function compactSql(value: unknown, maximumLength = 240): string {
  const query = String(value || '').replace(/\s+/g, ' ').trim()
  if (query.length <= maximumLength)
    return query
  return `${query.slice(0, Math.max(0, maximumLength - 1)).trimEnd()}…`
}

export function safeRequestPath(value: unknown): string {
  const path = String(value || '').trim()
  const queryIndex = path.indexOf('?')
  return queryIndex === -1 ? path : path.slice(0, queryIndex)
}

export function filesystemUsage(blockSize: unknown, blocks: unknown, availableBlocks: unknown) {
  const size = Math.max(0, finiteNumber(blockSize))
  const totalBytes = Math.max(0, size * finiteNumber(blocks))
  const availableBytes = Math.min(totalBytes, Math.max(0, size * finiteNumber(availableBlocks)))
  const usedBytes = Math.max(0, totalBytes - availableBytes)

  return {
    totalBytes,
    availableBytes,
    usedBytes,
    usedPercent: percent(usedBytes, totalBytes),
  }
}
