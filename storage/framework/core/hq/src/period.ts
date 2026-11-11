/** The metering period a moment falls in: `YYYY-MM`, in UTC. */
export function periodOf(at: Date | string = new Date()): string {
  return (typeof at === 'string' ? at : at.toISOString()).slice(0, 7)
}

export function isPeriod(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(?:0[1-9]|1[0-2])$/.test(value)
}
