/** Provider subscription state determines access; successful API creation alone does not. */
export function subscriptionGrantsAccess(status: string | null | undefined): boolean {
  return status === 'active' || status === 'trialing'
}

/** Read both legacy subscription periods and item periods used by newer Stripe APIs. */
export function subscriptionPeriod(subscription: {
  current_period_start?: number
  current_period_end?: number
  items?: { data?: Array<{ current_period_start?: number, current_period_end?: number }> }
}): { start: string | null, end: string | null } {
  const item = subscription.items?.data?.[0]
  const iso = (value: number | undefined): string | null => value && Number.isFinite(value) && value > 0 ? new Date(value * 1000).toISOString() : null
  return {
    start: iso(subscription.current_period_start ?? item?.current_period_start),
    end: iso(subscription.current_period_end ?? item?.current_period_end),
  }
}
